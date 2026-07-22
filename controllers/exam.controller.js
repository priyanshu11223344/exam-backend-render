const ExamAssignment = require("../models/ExamAssignment");
const ExamSubmission = require("../models/ExamSubmission");
const User = require("../models/User");
const TeacherAssignment = require("../models/TeacherAssignment");
const storeUploadedFile = require("../utils/storeUploadedFile");
const fs = require("fs/promises");

const cleanupUploads = async (files) => Promise.all((files || []).map((file) => fs.unlink(file.path).catch(() => {})));

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
    const { board, className, subject, studentEmail, audience } = req.query;
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
    const { userEmail, userName } = req.body;

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

    const assignmentRecord = await ExamAssignment.findById(assignmentId).select("dueAt status").lean();
    if (!assignmentRecord || assignmentRecord.status !== "published") {
      await cleanupUploads(req.files);
      return res.status(404).json({ success: false, error: "This assignment is no longer available." });
    }
    if (assignmentRecord.dueAt && new Date(assignmentRecord.dueAt) < new Date()) {
      await cleanupUploads(req.files);
      return res.status(409).json({ success: false, error: "The submission deadline has passed." });
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
    const { userEmail, userName, score, total, answers } = req.body;

    if (!userEmail) {
      return res.status(400).json({
        success: false,
        error: "Student email is required.",
      });
    }

    const assignmentRecord = await ExamAssignment.findById(assignmentId).select("dueAt status").lean();
    if (!assignmentRecord || assignmentRecord.status !== "published") {
      return res.status(404).json({ success: false, error: "This test is no longer available." });
    }
    if (assignmentRecord.dueAt && new Date(assignmentRecord.dueAt) < new Date()) {
      return res.status(409).json({ success: false, error: "The test deadline has passed." });
    }

    const submission = await ExamSubmission.findOneAndUpdate(
      { assignment: assignmentId, userEmail },
      {
        $set: {
          userName,
          quizResult: { score, total, answers },
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
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

exports.getMySubmissions = async (req, res) => {
  try {
    const userEmail = String(req.query.userEmail || "").trim().toLowerCase();
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
