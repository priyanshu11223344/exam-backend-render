const XLSX = require("xlsx");
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
    const workbook = XLSX.readFile(req.file.path);

    const sheet =
      workbook.Sheets[workbook.SheetNames[0]];

    const rows =
      XLSX.utils.sheet_to_json(sheet);

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
