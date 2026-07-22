const readXlsxFile = require("read-excel-file/node");
const fs = require("fs/promises");
const mongoose = require("mongoose");
const Board = require("../models/Board");
const Subject = require("../models/Subject");
const Topic = require("../models/Topic");
const Paper = require("../models/Paper");
const PaperName = require("../models/PaperName");
const Plan = require("../models/Plan");
const User = require("../models/User");

const {
  processPaperRow,
} = require("../services/paperUploadService");

/* =====================================
   EXCEL UPLOAD
===================================== */

exports.uploadExcel = async (req, res) => {
  const session = await mongoose.startSession();

  session.startTransaction();

  try {
    if (!req.file) return res.status(400).json({ error: "Upload an .xlsx file." });
    const sheetRows = await readXlsxFile(req.file.path);
    await fs.unlink(req.file.path).catch(() => {});
    if (!sheetRows.length) return res.status(400).json({ error: "The workbook is empty." });
    const headers = sheetRows[0].map((value) => String(value || "").trim());
    const rows = sheetRows.slice(1).map((values) => Object.fromEntries(
      headers.map((header, index) => [header, values[index]]).filter(([header]) => header)
    )).filter((record) => Object.values(record).some((value) => value !== null && value !== undefined && value !== ""));

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of rows) {
      const result =
        await processPaperRow(row, session);

      if (result === "inserted") inserted++;

      else if (result === "updated") updated++;

      else skipped++;
    }

    await session.commitTransaction();

    session.endSession();

    res.json({
      inserted,
      updated,
      skipped,
    });
  } catch (err) {
    if (req.file?.path) await fs.unlink(req.file.path).catch(() => {});
    await session.abortTransaction();

    session.endSession();

    console.log("error is", err.message);

    res.status(500).json({
      error: err.message,
    });
  }
};

/* =====================================
   FORM UPLOAD
===================================== */

exports.uploadQuestionsByForm = async (
  req,
  res
) => {
  const session = await mongoose.startSession();

  session.startTransaction();

  try {
    const rows = req.body.questions;

    if (
      !rows ||
      !Array.isArray(rows) ||
      rows.length === 0
    ) {
      return res.status(400).json({
        error: "Questions array is required",
      });
    }

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of rows) {
      const result =
        await processPaperRow(row, session);

      if (result === "inserted") inserted++;

      else if (result === "updated") updated++;

      else skipped++;
    }

    await session.commitTransaction();

    session.endSession();

    res.json({
      success: true,
      inserted,
      updated,
      skipped,
    });
  } catch (err) {
    await session.abortTransaction();

    session.endSession();

    console.log("error is", err.message);

    res.status(500).json({
      error: err.message,
    });
  }
};

exports.getDashboardSummary = async (req, res) => {
  try {
    const [
      boardCount,
      subjectCount,
      topicCount,
      paperNameCount,
      questionCount,
      mcqCount,
      pendingFileCount,
      failedFileCount,
      planCount,
      activePlanCount,
      userCount,
      paidUserCount,
      teacherCount,
      recentQuestions,
      recentUsers,
      boards,
      subjects,
      topics,
      plans,
    ] = await Promise.all([
      Board.countDocuments(),
      Subject.countDocuments(),
      Topic.countDocuments(),
      PaperName.countDocuments(),
      Paper.countDocuments(),
      Paper.countDocuments({ isMCQ: true }),
      Paper.countDocuments({
        $or: [
          { "questionPaper.status": "pending" },
          { "markScheme.status": "pending" },
          { "explanation.status": "pending" },
          { "specialComment.status": "pending" },
        ],
      }),
      Paper.countDocuments({
        $or: [
          { "questionPaper.status": "failed" },
          { "markScheme.status": "failed" },
          { "explanation.status": "failed" },
          { "specialComment.status": "failed" },
        ],
      }),
      Plan.countDocuments(),
      Plan.countDocuments({ isActive: true }),
      User.countDocuments(),
      User.countDocuments({ planId: { $ne: null } }),
      User.countDocuments({ role: "teacher" }),
      Paper.find()
        .sort({ updatedAt: -1 })
        .limit(8)
        .populate({
          path: "topic",
          select: "name subject",
          populate: {
            path: "subject",
            select: "name board",
            populate: { path: "board", select: "name" },
          },
        })
        .populate("paperName", "name")
        .lean(),
      User.find()
        .sort({ updatedAt: -1 })
        .limit(8)
        .select("name email role board school studentClass planName planExpiry createdAt updatedAt")
        .lean(),
      Board.find().sort({ name: 1 }).lean(),
      Subject.find().sort({ name: 1 }).populate("board", "name").lean(),
      Topic.find().sort({ name: 1 }).populate("subject", "name board").lean(),
      Plan.find().sort({ createdAt: -1 }).lean(),
    ]);

    const subjectCounts = subjects.reduce((acc, subject) => {
      const boardId = subject.board?._id?.toString();
      if (boardId) acc[boardId] = (acc[boardId] || 0) + 1;
      return acc;
    }, {});

    const topicCounts = topics.reduce((acc, topic) => {
      const subjectId = topic.subject?._id?.toString();
      if (subjectId) acc[subjectId] = (acc[subjectId] || 0) + 1;
      return acc;
    }, {});

    const contentMap = boards.map((board) => {
      const boardSubjects = subjects
        .filter((subject) => subject.board?._id?.toString() === board._id.toString())
        .map((subject) => ({
          _id: subject._id,
          name: subject.name,
          topicCount: topicCounts[subject._id.toString()] || 0,
        }));

      return {
        _id: board._id,
        name: board.name,
        subjectCount: subjectCounts[board._id.toString()] || 0,
        subjects: boardSubjects.slice(0, 6),
      };
    });

    res.json({
      success: true,
      data: {
        counts: {
          boards: boardCount,
          subjects: subjectCount,
          topics: topicCount,
          paperNames: paperNameCount,
          questions: questionCount,
          mcqQuestions: mcqCount,
          pendingFiles: pendingFileCount,
          failedFiles: failedFileCount,
          plans: planCount,
          activePlans: activePlanCount,
          users: userCount,
          paidUsers: paidUserCount,
          teachers: teacherCount,
        },
        recentQuestions,
        recentUsers,
        contentMap,
        plans,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const users = await User.find()
      .sort({ updatedAt: -1 })
      .limit(100)
      .select("name email role age board school studentClass planName planExpiry createdAt updatedAt")
      .lean();

    res.json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

exports.updateUserByAdmin = async (req, res) => {
  try {
    const allowedFields = [
      "name",
      "age",
      "board",
      "school",
      "studentClass",
      "planName",
      "planExpiry",
    ];
    const updates = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    if (updates.planExpiry === "") {
      updates.planExpiry = null;
    }

    if (updates.age === "") {
      updates.age = null;
    }

    if (updates.planName === "Free") {
      updates.planId = null;
      updates.planExpiry = null;
    } else if (updates.planName) {
      const selectedPlan = await Plan.findOne({
        name: { $regex: `^${updates.planName}$`, $options: "i" },
        isActive: true,
      });

      if (!selectedPlan) {
        return res.status(400).json({
          success: false,
          error: "Selected plan is not available.",
        });
      }

      updates.planId = selectedPlan._id;
      updates.planName = selectedPlan.name;

      if (!updates.planExpiry) {
        const longestDuration = [...(selectedPlan.durations || [])].sort(
          (a, b) => (b.durationDays || 0) - (a.durationDays || 0)
        )[0];
        const durationDays = longestDuration?.durationDays || 365;
        updates.planExpiry = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
      }
    }

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { $set: updates },
      { new: true, runValidators: true }
    )
      .select("name email role age board school studentClass planName planExpiry createdAt updatedAt")
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found.",
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};
