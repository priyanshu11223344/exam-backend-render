const ExamAssignment = require("../models/ExamAssignment");
const ExamSubmission = require("../models/ExamSubmission");
const User = require("../models/User");
const TeacherAssignment = require("../models/TeacherAssignment");
const Paper = require("../models/Paper");
const storeUploadedFile = require("../utils/storeUploadedFile");
const fs = require("fs/promises");

const cleanupUploads = async (files) => Promise.all((files || []).map((file) => fs.unlink(file.path).catch(() => {})));

const studentCanAccessAssignment = (assignment, user) => {
  if (!assignment || !user) return false;
  const email = String(user.email || "").toLowerCase();
  if (assignment.targetStudent?.email && assignment.targetStudent.email !== email) return false;
  if (assignment.audience === "class") {
    return assignment.board === user.board && String(assignment.className) === String(user.studentClass);
  }
  return assignment.board === user.subscriptionScope?.board &&
    (user.subscriptionScope?.subjects || []).includes(assignment.subject) &&
    user.planExpiry && new Date(user.planExpiry) > new Date();
};

exports.createAssignment = async (req, res) => {
  try {
    const {
      title,
      type,
      audience = "class",
      board,
      className,
      subject,
      instructions,
      dueAt,
      durationMinutes,
      year,
      season,
      paperName,
      variant,
      createdByRole,
      createdByEmail,
      targetStudentId,
      targetStudentEmail,
      targetStudentName,
    } = req.body;
    const actorRole = req.currentUser?.role || createdByRole;
    const actorEmail = String(req.currentUser?.email || createdByEmail || "").toLowerCase();

    if (!title || !type || !board || !subject || (audience === "class" && !className)) {
      await cleanupUploads(req.file ? [req.file] : []);
      return res.status(400).json({
        success: false,
        error: "Title, type, board, class and subject are required.",
      });
    }

    if (type === "paper" && !req.file) {
      return res.status(400).json({
        success: false,
        error: "Upload a question paper for paper assignments.",
      });
    }

    if (actorRole === "teacher") {
      const teacherAssignment = await TeacherAssignment.findOne({
        teacherEmail: actorEmail,
        board,
        "classes.className": className,
        active: true,
      }).lean();
      const assignedClass = teacherAssignment?.classes?.find((entry) => entry.className === className);

      if (!assignedClass) {
        await cleanupUploads(req.file ? [req.file] : []);
        return res.status(403).json({
          success: false,
          error: "This class is not assigned to the teacher.",
        });
      }

      if (assignedClass.subjects?.length && !assignedClass.subjects.includes(subject)) {
        await cleanupUploads(req.file ? [req.file] : []);
        return res.status(403).json({
          success: false,
          error: "This subject is not assigned to the teacher for the selected class.",
        });
      }
    }

    let targetStudent;
    const normalizedTargetEmail = String(targetStudentEmail || "").trim().toLowerCase();

    if (targetStudentId || normalizedTargetEmail) {
      const student = targetStudentId
        ? await User.findById(targetStudentId).select("name email board studentClass role").lean()
        : await User.findOne({ email: normalizedTargetEmail }).select("name email board studentClass role").lean();

      if (!student || student.role === "teacher" || student.role === "admin") {
        await cleanupUploads(req.file ? [req.file] : []);
        return res.status(400).json({
          success: false,
          error: "Select a valid student for this assignment.",
        });
      }

      if (student.board && student.board !== board) {
        await cleanupUploads(req.file ? [req.file] : []);
        return res.status(400).json({
          success: false,
          error: "Selected student does not belong to this board.",
        });
      }

      if (student.studentClass && String(student.studentClass) !== String(className)) {
        await cleanupUploads(req.file ? [req.file] : []);
        return res.status(400).json({
          success: false,
          error: "Selected student does not belong to this class.",
        });
      }

      targetStudent = {
        user: student._id,
        name: student.name || targetStudentName || "Student",
        email: student.email || normalizedTargetEmail,
      };
    } else if (normalizedTargetEmail) {
      targetStudent = {
        name: targetStudentName || "Student",
        email: normalizedTargetEmail,
      };
    }

    const storedQuestionPaper = type === "paper" ? await storeUploadedFile(req.file, "aurethia/assignments") : undefined;
    const assignment = await ExamAssignment.create({
      title,
      type,
      audience: audience === "subscribers" ? "subscribers" : "class",
      board,
      className: audience === "subscribers" ? "SUBSCRIBERS" : className,
      subject,
      instructions,
      dueAt: dueAt || undefined,
      durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
      quizConfig: type === "quiz" ? { year, season, paperName, variant } : undefined,
      questionPaper: storedQuestionPaper,
      targetStudent,
      createdByRole: actorRole === "teacher" ? "teacher" : "admin",
      createdByEmail: actorEmail,
      status: "published",
    });

    res.status(201).json({
      success: true,
      data: assignment,
    });
  } catch (err) {
    await cleanupUploads(req.file ? [req.file] : []);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

exports.getAssignments = async (req, res) => {
  try {
    let { board, className, subject, studentEmail, audience } = req.query;
    if (req.currentUser?.role === "user") {
      const currentUser = req.currentUser;
      studentEmail = currentUser.email;
      if (audience === "subscribers") {
        board = currentUser.subscriptionScope?.board;
        className = undefined;
        if (!currentUser.planExpiry || new Date(currentUser.planExpiry) <= new Date()) {
          return res.json({ success: true, count: 0, data: [], pagination: { page: 1, limit: 100, total: 0, pages: 0 } });
        }
        if (subject && !(currentUser.subscriptionScope?.subjects || []).includes(subject)) subject = "__not_allowed__";
      } else {
        audience = "class";
        board = currentUser.board;
        className = currentUser.studentClass;
      }
    }
    const filter = { status: "published" };

    if (board) filter.board = board;
    if (className) filter.className = className;
    if (subject) filter.subject = subject;
    if (audience) filter.audience = audience;
    if (studentEmail) {
      const email = String(studentEmail).trim().toLowerCase();
      filter.$or = [
        { "targetStudent.email": { $exists: false } },
        { "targetStudent.email": "" },
        { "targetStudent.email": email },
      ];
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const [assignments, total] = await Promise.all([
      ExamAssignment.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      ExamAssignment.countDocuments(filter),
    ]);

    res.json({
      success: true,
      count: assignments.length,
      data: assignments,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

exports.submitAnswerSheets = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const userEmail = req.currentUser?.email;
    const userName = req.currentUser?.name;

    if (!userEmail) {
      await cleanupUploads(req.files);
      return res.status(400).json({
        success: false,
        error: "Student email is required.",
      });
    }

    if (!req.files?.length) {
      return res.status(400).json({
        success: false,
        error: "Upload at least one answer-sheet image.",
      });
    }

    const assignmentRecord = await ExamAssignment.findById(assignmentId).lean();
    if (!assignmentRecord || assignmentRecord.status !== "published") {
      await cleanupUploads(req.files);
      return res.status(404).json({ success: false, error: "This assignment is no longer available." });
    }
    if (assignmentRecord.dueAt && new Date(assignmentRecord.dueAt) < new Date()) {
      await cleanupUploads(req.files);
      return res.status(409).json({ success: false, error: "The submission deadline has passed." });
    }
    if (assignmentRecord.type !== "paper" || !studentCanAccessAssignment(assignmentRecord, req.currentUser)) {
      await cleanupUploads(req.files);
      return res.status(403).json({ success: false, error: "This paper is not assigned to your account." });
    }

    const storedAnswerSheets = await Promise.all(req.files.map((file) => storeUploadedFile(file, "aurethia/submissions")));
    const submission = await ExamSubmission.findOneAndUpdate(
      { assignment: assignmentId, userEmail },
      {
        $set: {
          userName,
          answerSheets: storedAnswerSheets,
          status: "submitted",
          submittedAt: new Date(),
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    res.json({
      success: true,
      data: submission,
    });
  } catch (err) {
    await cleanupUploads(req.files);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

exports.submitQuizResult = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { answers = {} } = req.body;
    const userEmail = req.currentUser?.email;
    const userName = req.currentUser?.name;

    if (!userEmail) {
      return res.status(400).json({
        success: false,
        error: "Student email is required.",
      });
    }

    const assignmentRecord = await ExamAssignment.findById(assignmentId).lean();
    if (!assignmentRecord || assignmentRecord.status !== "published") {
      return res.status(404).json({ success: false, error: "This test is no longer available." });
    }
    if (assignmentRecord.dueAt && new Date(assignmentRecord.dueAt) < new Date()) {
      return res.status(409).json({ success: false, error: "The test deadline has passed." });
    }
    if (assignmentRecord.type !== "quiz" || !studentCanAccessAssignment(assignmentRecord, req.currentUser)) {
      return res.status(403).json({ success: false, error: "This test is not assigned to your account." });
    }

    const questionIds = Object.keys(answers).filter((id) => /^[a-f\d]{24}$/i.test(id));
    const questions = await Paper.find({ _id: { $in: questionIds }, isMCQ: true }).select("correctAnswer").lean();
    const total = questions.length;
    const score = questions.reduce((sum, question) => sum + (answers[String(question._id)] === question.correctAnswer ? 1 : 0), 0);
    if (!total) return res.status(400).json({ success: false, error: "No valid test answers were submitted." });

    const submission = await ExamSubmission.findOneAndUpdate(
      { assignment: assignmentId, userEmail },
      {
        $set: {
          userName,
          quizResult: { score, total, answers },
          status: "graded",
          grade: `${score}/${total}`,
          feedback: "Automatically marked using the stored answer key.",
          gradedBy: "system",
          gradedAt: new Date(),
          submittedAt: new Date(),
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    res.json({
      success: true,
      data: submission,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

exports.getMySubmissions = async (req, res) => {
  try {
    const userEmail = req.currentUser?.role === "admin"
      ? String(req.query.userEmail || "").trim().toLowerCase()
      : String(req.currentUser?.email || "").trim().toLowerCase();
    if (!userEmail) return res.status(400).json({ success: false, error: "Student email is required." });
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const [data, total] = await Promise.all([
      ExamSubmission.find({ userEmail }).populate("assignment", "title subject className dueAt type").sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      ExamSubmission.countDocuments({ userEmail }),
    ]);
    return res.json({ success: true, data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
