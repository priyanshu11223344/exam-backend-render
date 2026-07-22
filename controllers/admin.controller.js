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
const { clerkClient } = require("@clerk/express");

const ADMIN_PERMISSIONS = [
  "overview", "content", "questions", "assignments", "teachers",
  "remarks", "students", "plans", "links", "users_manage",
];
const LEGACY_STUDENT_ROLE_FILTER = {
  $or: [{ role: "user" }, { role: { $exists: false } }, { role: null }, { role: "" }],
};
const normalizeLegacyRole = (user) => ({
  ...user,
  role: ["admin", "staff", "teacher", "user"].includes(user.role) ? user.role : "user",
});

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
      User.countDocuments(LEGACY_STUDENT_ROLE_FILTER),
      User.countDocuments({ $and: [LEGACY_STUDENT_ROLE_FILTER, { planId: { $ne: null } }] }),
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

    const isSuperAdmin = req.currentUser?.role === "admin";
    const permissions = new Set(req.currentUser?.adminPermissions || []);
    const include = (...items) => isSuperAdmin || items.some((item) => permissions.has(item));
    const visibleRoles = permissions.has("users_manage")
      ? ["user", "teacher", "staff"]
      : [permissions.has("students") ? "user" : null, permissions.has("teachers") ? "teacher" : null].filter(Boolean);
    const normalizedRecentUsers = recentUsers.map(normalizeLegacyRole);
    const visibleRecentUsers = isSuperAdmin
      ? normalizedRecentUsers
      : normalizedRecentUsers.filter((user) => visibleRoles.includes(user.role));

    res.json({
      success: true,
      data: {
        counts: include("overview") ? {
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
        } : {},
        recentQuestions: include("overview", "questions", "assignments") ? recentQuestions : [],
        recentUsers: include("overview", "students", "teachers", "users_manage") ? visibleRecentUsers : [],
        contentMap: include("overview", "content", "questions", "assignments") ? contentMap : [],
        plans: include("overview", "plans", "students") ? plans : [],
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
    const permissions = new Set(req.currentUser?.adminPermissions || []);
    let roleFilter = {};
    if (req.currentUser?.role !== "admin") {
      const canReadStudents = permissions.has("students") || permissions.has("users_manage");
      const allowedRoles = permissions.has("users_manage")
        ? ["user", "teacher", "staff"]
        : [canReadStudents ? "user" : null, permissions.has("teachers") ? "teacher" : null].filter(Boolean);
      roleFilter = canReadStudents
        ? { $or: [{ role: { $in: allowedRoles } }, { role: { $exists: false } }, { role: null }, { role: "" }] }
        : { role: { $in: allowedRoles } };
    }
    const users = await User.find(roleFilter)
      .sort({ updatedAt: -1 })
      .limit(100)
      .select("name email role adminPermissions age board school studentClass planName planExpiry createdAt updatedAt")
      .lean();

    res.json({
      success: true,
      count: users.length,
      data: users.map(normalizeLegacyRole),
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

exports.createUserByAdmin = async (req, res) => {
  let clerkUser;
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const temporaryPassword = String(req.body.temporaryPassword || "");
    const role = String(req.body.role || "user");
    const allowedRoles = ["user", "teacher", "staff"];

    if (!name || !/^\S+@\S+\.\S+$/.test(email) || temporaryPassword.length < 8) {
      return res.status(400).json({ success: false, error: "Name, a valid email and a password of at least 8 characters are required." });
    }
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ success: false, error: "Select a valid non-superadmin role." });
    }

    const board = String(req.body.board || "").trim();
    const studentClass = String(req.body.studentClass || "").trim();
    if (role === "user") {
      if (!board || !/^(?:[1-9]|1[0-2])$/.test(studentClass)) {
        return res.status(400).json({ success: false, error: "Board and class are required for student accounts." });
      }
      if (!(await Board.exists({ name: board }))) {
        return res.status(400).json({ success: false, error: "Select a valid board." });
      }
    }

    const adminPermissions = role === "staff"
      ? [...new Set((Array.isArray(req.body.adminPermissions) ? req.body.adminPermissions : []).filter((item) => ADMIN_PERMISSIONS.includes(item)))]
      : [];
    if (role === "staff" && adminPermissions.length === 0) {
      return res.status(400).json({ success: false, error: "Select at least one permission for an admin staff account." });
    }
    if (await User.exists({ email })) {
      return res.status(409).json({ success: false, error: "A user with this email already exists." });
    }

    const nameParts = name.split(/\s+/);
    clerkUser = await clerkClient.users.createUser({
      emailAddress: [email],
      password: temporaryPassword,
      firstName: nameParts.shift(),
      lastName: nameParts.join(" ") || undefined,
      publicMetadata: { role },
    });

    const user = await User.create({
      clerkId: clerkUser.id,
      name,
      email,
      role,
      adminPermissions,
      board: role === "user" ? board : "",
      school: role === "user" ? String(req.body.school || "").trim() : "",
      studentClass: role === "user" ? studentClass : "",
      profileCompletedAt: role === "user" ? new Date() : null,
    });

    return res.status(201).json({
      success: true,
      data: user.toObject(),
      message: "Account created. Share the temporary password securely and ask the user to change it after signing in.",
    });
  } catch (err) {
    if (clerkUser?.id) await clerkClient.users.deleteUser(clerkUser.id).catch(() => {});
    const clerkMessage = err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message;
    return res.status(err?.status || 500).json({ success: false, error: clerkMessage || err.message });
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
      .select("name email role adminPermissions age board school studentClass planName planExpiry createdAt updatedAt")
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
