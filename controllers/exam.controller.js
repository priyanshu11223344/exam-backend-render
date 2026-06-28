const ExamAssignment = require("../models/ExamAssignment");
const ExamSubmission = require("../models/ExamSubmission");

const toUploadedFile = (file) => {
  if (!file) return undefined;

  return {
    originalName: file.originalname,
    filename: file.filename,
    path: `/uploads/${file.filename}`,
    mimeType: file.mimetype,
    size: file.size,
  };
};

exports.createAssignment = async (req, res) => {
  try {
    const {
      title,
      type,
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
    } = req.body;

    if (!title || !type || !board || !className || !subject) {
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

    const assignment = await ExamAssignment.create({
      title,
      type,
      board,
      className,
      subject,
      instructions,
      dueAt: dueAt || undefined,
      durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
      quizConfig: type === "quiz" ? { year, season, paperName, variant } : undefined,
      questionPaper: type === "paper" ? toUploadedFile(req.file) : undefined,
      createdByRole: createdByRole === "teacher" ? "teacher" : "admin",
      createdByEmail,
      status: "published",
    });

    res.status(201).json({
      success: true,
      data: assignment,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

exports.getAssignments = async (req, res) => {
  try {
    const { board, className, subject } = req.query;
    const filter = { status: "published" };

    if (board) filter.board = board;
    if (className) filter.className = className;
    if (subject) filter.subject = subject;

    const assignments = await ExamAssignment.find(filter).sort({ createdAt: -1 }).lean();

    res.json({
      success: true,
      count: assignments.length,
      data: assignments,
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

    const submission = await ExamSubmission.findOneAndUpdate(
      { assignment: assignmentId, userEmail },
      {
        $set: {
          userName,
          answerSheets: req.files.map(toUploadedFile),
          status: "submitted",
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

    const submission = await ExamSubmission.findOneAndUpdate(
      { assignment: assignmentId, userEmail },
      {
        $set: {
          userName,
          quizResult: { score, total, answers },
          status: "submitted",
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
