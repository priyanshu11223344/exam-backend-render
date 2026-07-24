const ExamAssignment = require("../models/ExamAssignment");
const ExamSubmission = require("../models/ExamSubmission");
const User = require("../models/User");
const TeacherAssignment = require("../models/TeacherAssignment");
const Paper = require("../models/Paper");
const storeUploadedFile = require("../utils/storeUploadedFile");
const { readStoredPaper, validateUploadedPaper } = require("../utils/paperFile");
const fs = require("fs/promises");

const cleanupUploads = async (files) => Promise.all((files || []).map((file) => fs.unlink(file.path).catch(() => {})));
const normalizeWebUrl = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  try {
    const parsed = new URL(normalized);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : "";
  } catch {
    return "";
  }
};

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
      testLink,
      maximumMarks,
      markingSchemeLink,
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

    const normalizedTestLink = normalizeWebUrl(testLink);
    const normalizedMarkingSchemeLink = normalizeWebUrl(markingSchemeLink);
    const parsedMaximumMarks = Number(maximumMarks);

    if (testLink && !normalizedTestLink) {
      await cleanupUploads(req.file ? [req.file] : []);
      return res.status(400).json({ success: false, error: "Enter a valid test link using http or https." });
    }
    if (markingSchemeLink && !normalizedMarkingSchemeLink) {
      await cleanupUploads(req.file ? [req.file] : []);
      return res.status(400).json({ success: false, error: "Enter a valid marking scheme link using http or https." });
    }
    if (maximumMarks && (!Number.isFinite(parsedMaximumMarks) || parsedMaximumMarks <= 0)) {
      await cleanupUploads(req.file ? [req.file] : []);
      return res.status(400).json({ success: false, error: "Maximum marks must be greater than zero." });
    }

    if (type === "paper" && !req.file && !normalizedTestLink) {
      return res.status(400).json({
        success: false,
        error: "Upload a question paper file or provide a test link.",
      });
    }

    if (type === "paper" && req.file) {
      try {
        const detectedPaper = await validateUploadedPaper(req.file);
        req.file.mimetype = detectedPaper.mimeType;
      } catch (validationError) {
        await cleanupUploads([req.file]);
        return res.status(400).json({
          success: false,
          error: validationError.message,
        });
      }
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

      if (!student || student.role !== "user") {
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

    const storedQuestionPaper = type === "paper" && req.file
      ? await storeUploadedFile(req.file, "aurethia/assignments")
      : undefined;
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
      testLink: normalizedTestLink,
      maximumMarks: maximumMarks ? parsedMaximumMarks : undefined,
      markingSchemeLink: normalizedMarkingSchemeLink,
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

    let visibleAssignments = assignments;
    if (req.currentUser?.role === "user") {
      const submittedAssignmentIds = new Set(
        (await ExamSubmission.find({
          userEmail: String(req.currentUser.email || "").toLowerCase(),
          assignment: { $in: assignments.map((assignment) => assignment._id) },
        }).select("assignment").lean()).map((submission) => String(submission.assignment))
      );
      visibleAssignments = assignments.map((assignment) => {
        const safeAssignment = { ...assignment };
        if (safeAssignment.questionPaper) {
          safeAssignment.questionPaper = {
            originalName: safeAssignment.questionPaper.originalName,
            mimeType: safeAssignment.questionPaper.mimeType,
            size: safeAssignment.questionPaper.size,
            available: true,
          };
        }
        if (!submittedAssignmentIds.has(String(assignment._id))) {
          delete safeAssignment.markingSchemeLink;
        }
        return safeAssignment;
      });
    }

    res.json({
      success: true,
      count: visibleAssignments.length,
      data: visibleAssignments,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

exports.viewQuestionPaper = async (req, res) => {
  try {
    const assignment = await ExamAssignment.findById(req.params.assignmentId).lean();
    if (!assignment || assignment.type !== "paper" || !assignment.questionPaper) {
      return res.status(404).json({ success: false, error: "Question paper not found." });
    }

    const currentUser = req.currentUser;
    let canView = ["admin", "staff"].includes(currentUser.role);

    if (currentUser.role === "user") {
      canView = studentCanAccessAssignment(assignment, currentUser);
    } else if (currentUser.role === "teacher") {
      const teacherEmail = String(currentUser.email || "").toLowerCase();
      canView = assignment.createdByEmail === teacherEmail;
      if (!canView) {
        const teacherAssignment = await TeacherAssignment.findOne({
          teacherEmail,
          board: assignment.board,
          "classes.className": assignment.className,
          active: true,
        }).lean();
        const assignedClass = teacherAssignment?.classes?.find(
          (entry) => String(entry.className) === String(assignment.className)
        );
        canView = Boolean(
          assignedClass &&
          (!assignedClass.subjects?.length || assignedClass.subjects.includes(assignment.subject))
        );
      }
    }

    if (!canView) {
      return res.status(403).json({ success: false, error: "You cannot access this question paper." });
    }

    const paper = await readStoredPaper(assignment.questionPaper);
    const baseName = String(assignment.title || "question-paper")
      .replace(/[^a-z0-9_-]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "question-paper";

    res.set({
      "Content-Type": paper.mimeType,
      "Content-Disposition": `inline; filename="${baseName}.${paper.extension}"`,
      "Content-Length": String(paper.buffer.length),
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    return res.send(paper.buffer);
  } catch (err) {
    const status = err.name === "TimeoutError" ? 504 : 502;
    return res.status(status).json({
      success: false,
      error: status === 504 ? "Question paper storage timed out." : err.message,
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
      ExamSubmission.find({ userEmail })
        .populate("assignment", "title subject className dueAt type createdAt maximumMarks markingSchemeLink testLink")
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ExamSubmission.countDocuments({ userEmail }),
    ]);
    return res.json({ success: true, data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
