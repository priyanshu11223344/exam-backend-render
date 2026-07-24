const User = require("../models/User");
const TeacherAssignment = require("../models/TeacherAssignment");
const ClassSession = require("../models/ClassSession");
const Board = require("../models/Board");
const Subject = require("../models/Subject");
const mongoose = require("mongoose");
const { processPaperRow } = require("../services/paperUploadService");
const { clerkClient } = require("@clerk/express");

const normalizeClasses = (classes) => {
  if (typeof classes === "string") {
    return classes
      .split(",")
      .map((className) => ({ className: className.trim(), subjects: [] }))
      .filter((entry) => entry.className);
  }

  if (!Array.isArray(classes)) return [];

  return classes
    .map((entry) => {
      if (typeof entry === "string") {
        return { className: entry.trim(), subjects: [] };
      }

      return {
        className: String(entry.className || "").trim(),
        subjects: Array.isArray(entry.subjects)
          ? entry.subjects.map((subject) => String(subject).trim()).filter(Boolean)
          : String(entry.subjects || "")
              .split(",")
              .map((subject) => subject.trim())
              .filter(Boolean),
      };
    })
    .filter((entry) => entry.className);
};

const getTeacherUser = async ({ teacherId, teacherEmail, teacherName }) => {
  let teacher = null;

  if (teacherId) {
    teacher = await User.findById(teacherId);
  }

  if (!teacher && teacherEmail) {
    teacher = await User.findOne({ email: teacherEmail.toLowerCase() });
  }

  if (!teacher && teacherEmail) {
    teacher = await User.create({
      clerkId: `manual-teacher:${teacherEmail.toLowerCase()}`,
      email: teacherEmail.toLowerCase(),
      name: teacherName || "Teacher",
      role: "teacher",
    });
  }

  if (!teacher) {
    throw new Error("Teacher user could not be found or created.");
  }

  if (["admin", "staff"].includes(teacher.role)) {
    throw new Error("Admin accounts cannot be converted into teacher accounts.");
  }

  teacher.role = "teacher";
  if (teacherName) teacher.name = teacherName;
  if (teacherEmail && !teacher.email) teacher.email = teacherEmail.toLowerCase();
  await teacher.save();

  if (teacher.clerkId && !teacher.clerkId.startsWith("manual-teacher:")) {
    await clerkClient.users.updateUserMetadata(teacher.clerkId, {
      publicMetadata: { role: "teacher" },
    });
  }

  return teacher;
};

const getAssignmentForEmail = async (email) => {
  return TeacherAssignment.findOne({
    teacherEmail: String(email || "").toLowerCase(),
    active: true,
  }).lean();
};

const getAssignmentsForEmail = async (email) => {
  return TeacherAssignment.find({
    teacherEmail: String(email || "").toLowerCase(),
    active: true,
  }).sort({ board: 1 }).lean();
};

exports.assignTeacher = async (req, res) => {
  try {
    const { teacherId, teacherEmail, teacherName, board, classes, mergeClasses = false } = req.body;

    if ((!teacherId && !teacherEmail) || !board) {
      return res.status(400).json({
        success: false,
        error: "Teacher and board are required.",
      });
    }

    const normalizedClasses = normalizeClasses(classes);

    if (!normalizedClasses.length) {
      return res.status(400).json({
        success: false,
        error: "Assign at least one class to the teacher.",
      });
    }

    if (normalizedClasses.some((entry) => !entry.subjects.length)) {
      return res.status(400).json({
        success: false,
        error: "Assign at least one subject for every selected class.",
      });
    }

    const boardDocument = await Board.findOne({ name: board }).select("_id").lean();
    if (!boardDocument) {
      return res.status(400).json({ success: false, error: "Selected board does not exist." });
    }

    const requestedSubjects = [...new Set(normalizedClasses.flatMap((entry) => entry.subjects))];
    const validSubjects = await Subject.find({
      board: boardDocument._id,
      name: { $in: requestedSubjects },
    }).select("name").lean();
    const validSubjectNames = new Set(validSubjects.map((subject) => subject.name));
    const invalidSubjects = requestedSubjects.filter((subject) => !validSubjectNames.has(subject));
    if (invalidSubjects.length) {
      return res.status(400).json({
        success: false,
        error: `Invalid subject selection for ${board}: ${invalidSubjects.join(", ")}`,
      });
    }

    const teacher = await getTeacherUser({ teacherId, teacherEmail, teacherName });

    let classesToSave = normalizedClasses;
    if (mergeClasses) {
      const existingAssignment = await TeacherAssignment.findOne({
        teacherEmail: teacher.email.toLowerCase(),
        board,
      }).lean();
      const mergedClasses = new Map(
        (existingAssignment?.classes || []).map((entry) => [entry.className, entry])
      );
      normalizedClasses.forEach((entry) => mergedClasses.set(entry.className, entry));
      classesToSave = [...mergedClasses.values()];
    }

    const assignment = await TeacherAssignment.findOneAndUpdate(
      {
        teacherEmail: teacher.email.toLowerCase(),
        board,
      },
      {
        $set: {
          teacher: teacher._id,
          teacherEmail: teacher.email.toLowerCase(),
          teacherName: teacher.name || teacherName || "Teacher",
          board,
          classes: classesToSave,
          active: true,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, data: assignment });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getAdminTeachers = async (_req, res) => {
  try {
    const [teachers, assignments] = await Promise.all([
      User.find({ role: "teacher" })
        .sort({ updatedAt: -1 })
        .select("name email board school studentClass createdAt updatedAt")
        .lean(),
      TeacherAssignment.find({ active: true })
        .sort({ updatedAt: -1 })
        .populate("teacher", "name email")
        .lean(),
    ]);

    const normalizedAssignments = assignments.map((assignment) => ({
      ...assignment,
      classes: Array.isArray(assignment.classes) ? assignment.classes : [],
    }));

    res.json({ success: true, data: { teachers, assignments: normalizedAssignments } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getTeacherContext = async (req, res) => {
  try {
    const email = String(req.query.email || req.get("x-local-user-email") || "").toLowerCase();

    if (!email) {
      return res.status(400).json({ success: false, error: "Teacher email is required." });
    }

    const assignments = await getAssignmentsForEmail(email);
    const assignment = assignments[0] || null;

    if (!assignments.length) {
      return res.json({
        success: true,
        data: {
          assignment: null,
          assignments: [],
          students: [],
          sessions: [],
        },
      });
    }

    const studentScopes = assignments.flatMap((entry) =>
      entry.classes.map((assignedClass) => ({
        board: entry.board,
        studentClass: assignedClass.className,
      }))
    );

    const [students, sessions] = await Promise.all([
      User.find({
        role: "user",
        $or: studentScopes,
      })
        .sort({ studentClass: 1, name: 1 })
        .limit(500)
        .select("name email school board studentClass age planName updatedAt")
        .lean(),
      ClassSession.find({ teacherEmail: email })
        .sort({ startsAt: 1 })
        .limit(500)
        .lean(),
    ]);

    res.json({
      success: true,
      data: {
        assignment,
        assignments,
        students,
        sessions,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getStudentWorkspace = async (req, res) => {
  try {
    const currentUser = req.currentUser;
    const board = String(currentUser?.board || "").trim();
    const className = String(currentUser?.studentClass || "").trim();

    if (!board || !className) {
      return res.json({ success: true, data: { board, className, subjects: [], teachers: [] } });
    }

    const assignments = await TeacherAssignment.find({
      board,
      active: true,
      classes: { $elemMatch: { className } },
    })
      .select("teacherName teacherEmail classes")
      .sort({ teacherName: 1 })
      .lean();

    const teachers = assignments.map((assignment) => {
      const assignedClass = assignment.classes.find((entry) => entry.className === className);
      return {
        name: assignment.teacherName,
        email: assignment.teacherEmail,
        subjects: assignedClass?.subjects || [],
      };
    });
    const subjects = [...new Set(teachers.flatMap((teacher) => teacher.subjects))].sort();

    res.json({ success: true, data: { board, className, subjects, teachers } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.uploadTeacherQuestions = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const teacherEmail = String(req.body.teacherEmail || req.get("x-local-user-email") || "").toLowerCase();
    const rows = req.body.questions;

    if (!teacherEmail) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, error: "Teacher email is required." });
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, error: "Questions array is required." });
    }

    const assignments = await getAssignmentsForEmail(teacherEmail);

    if (!assignments.length) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ success: false, error: "This teacher has no active class assignment." });
    }

    const assignmentByBoard = new Map(assignments.map((entry) => [entry.board, entry]));
    const invalidRow = rows.find((row) => {
      const teacherAssignment = assignmentByBoard.get(String(row.board || "").trim());
      if (!teacherAssignment) return true;
      const allowedSubjects = new Set(teacherAssignment.classes.flatMap((entry) => entry.subjects || []));
      return allowedSubjects.size && !allowedSubjects.has(String(row.subject || "").trim());
    });
    if (invalidRow) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        success: false,
        error: `Board/subject ${invalidRow.board || "(missing)"} / ${invalidRow.subject || "(missing)"} is not assigned to this teacher.`,
      });
    }

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of rows) {
      const questionRow = { ...row, board: String(row.board || "").trim() };

      const result = await processPaperRow(questionRow, session);

      if (result === "inserted") inserted++;
      else if (result === "updated") updated++;
      else skipped++;
    }

    await session.commitTransaction();
    session.endSession();

    res.json({ success: true, inserted, updated, skipped });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.createSession = async (req, res) => {
  try {
    const {
      teacherEmail,
      teacherName,
      board,
      className,
      subject,
      title,
      startsAt,
      endsAt,
      meetingLink,
      topicTaught,
      specificComments,
      studentFeedback,
    } = req.body;

    if (!teacherEmail || !board || !className || !subject || !title || !startsAt) {
      return res.status(400).json({
        success: false,
        error: "Teacher email, board, class, subject, title and start time are required.",
      });
    }

    const teacher = await getTeacherUser({ teacherEmail, teacherName });
    const assignment = await TeacherAssignment.findOne({
      teacherEmail: teacher.email.toLowerCase(),
      board,
      "classes.className": className,
      active: true,
    });

    if (!assignment) {
      return res.status(403).json({
        success: false,
        error: "This class is not assigned to the teacher.",
      });
    }

    const assignedClass = assignment.classes.find((entry) => entry.className === className);
    if (assignedClass?.subjects?.length && !assignedClass.subjects.includes(subject)) {
      return res.status(403).json({
        success: false,
        error: "This subject is not assigned to the teacher for the selected class.",
      });
    }

    const session = await ClassSession.create({
      teacher: teacher._id,
      teacherEmail: teacher.email.toLowerCase(),
      teacherName: teacher.name || teacherName,
      board,
      className,
      subject,
      title,
      startsAt,
      endsAt: endsAt || undefined,
      meetingLink,
      topicTaught,
      specificComments,
      studentFeedback,
    });

    res.status(201).json({ success: true, data: session });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.updateSessionRemark = async (req, res) => {
  try {
    const { teacherRemark, teacherIssues, topicTaught, specificComments, studentFeedback, status } = req.body;

    const session = await ClassSession.findByIdAndUpdate(
      req.params.sessionId,
      {
        $set: {
          teacherRemark,
          teacherIssues,
          topicTaught,
          specificComments,
          studentFeedback,
          status: status || "completed",
          remarkUpdatedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!session) {
      return res.status(404).json({ success: false, error: "Class session not found." });
    }

    res.json({ success: true, data: session });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getAdminRemarks = async (_req, res) => {
  try {
    const sessions = await ClassSession.find()
      .sort({ startsAt: -1 })
      .populate("teacher", "name email")
      .lean();

    res.json({ success: true, count: sessions.length, data: sessions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.updateSuperadminNote = async (req, res) => {
  try {
    const session = await ClassSession.findByIdAndUpdate(
      req.params.sessionId,
      { $set: { superadminNote: req.body.superadminNote || "" } },
      { new: true }
    );

    if (!session) {
      return res.status(404).json({ success: false, error: "Class session not found." });
    }

    res.json({ success: true, data: session });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getStudentSessions = async (req, res) => {
  try {
    const currentUser = req.currentUser;
    const board = currentUser?.role === "admin" ? req.query.board : currentUser?.board;
    const className = currentUser?.role === "admin" ? req.query.className : currentUser?.studentClass;

    if (!board || !className) {
      return res.json({ success: true, count: 0, data: [] });
    }

    const sessions = await ClassSession.find({
      board,
      className,
      status: { $ne: "cancelled" },
    })
      .sort({ startsAt: 1 })
      .select("-teacherIssues -superadminNote")
      .lean();

    res.json({ success: true, count: sessions.length, data: sessions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
