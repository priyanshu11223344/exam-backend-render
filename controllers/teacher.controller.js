const User = require("../models/User");
const TeacherAssignment = require("../models/TeacherAssignment");
const ClassSession = require("../models/ClassSession");

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

  teacher.role = "teacher";
  if (teacherName) teacher.name = teacherName;
  if (teacherEmail && !teacher.email) teacher.email = teacherEmail.toLowerCase();
  await teacher.save();

  return teacher;
};

const getAssignmentForEmail = async (email) => {
  return TeacherAssignment.findOne({
    teacherEmail: String(email || "").toLowerCase(),
    active: true,
  }).lean();
};

exports.assignTeacher = async (req, res) => {
  try {
    const { teacherId, teacherEmail, teacherName, board, classes } = req.body;

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

    const teacher = await getTeacherUser({ teacherId, teacherEmail, teacherName });

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
          classes: normalizedClasses,
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

    const assignment = await getAssignmentForEmail(email);

    if (!assignment) {
      return res.json({
        success: true,
        data: {
          assignment: null,
          students: [],
          sessions: [],
        },
      });
    }

    const classNames = assignment.classes.map((entry) => entry.className);

    const [students, sessions] = await Promise.all([
      User.find({
        role: { $ne: "teacher" },
        board: assignment.board,
        studentClass: { $in: classNames },
      })
        .sort({ studentClass: 1, name: 1 })
        .select("name email school board studentClass age planName updatedAt")
        .lean(),
      ClassSession.find({ teacherEmail: email })
        .sort({ startsAt: 1 })
        .lean(),
    ]);

    res.json({
      success: true,
      data: {
        assignment,
        students,
        sessions,
      },
    });
  } catch (err) {
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
    });

    res.status(201).json({ success: true, data: session });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.updateSessionRemark = async (req, res) => {
  try {
    const { teacherRemark, teacherIssues, status } = req.body;

    const session = await ClassSession.findByIdAndUpdate(
      req.params.sessionId,
      {
        $set: {
          teacherRemark,
          teacherIssues,
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
    const { board, className } = req.query;

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
