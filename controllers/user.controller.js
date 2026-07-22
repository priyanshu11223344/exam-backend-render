// controllers/userController.js

const Plan = require("../models/Plan");
const getOrCreateUser = require("../utils/getOrCreateUser");
const User = require("../models/User");
const Board = require("../models/Board");


// ✅ GET CURRENT USER (Dashboard Data)
exports.getMe = async (req, res) => {
  try {
    const user = await getOrCreateUser(req);
    const isAdmin = user.role === "admin";
    const isTeacher = user.role === "teacher";

    // ✅ DEFAULT FREE FEATURES
    let features = isAdmin
      ? ["topical", "mcq", "pdf", "years_access"]
      : ["topical"];

    // ✅ DEFAULT PLAN INFO
    let activePlanName = isAdmin ? "Admin" : "Free";
    let activePlanExpiry = null;
    let activeProductType = isAdmin ? "complete" : "free";

    // ✅ CHECK IF PLAN EXPIRED
    const isPlanExpired =
      !isAdmin &&
      user.planExpiry &&
      new Date(user.planExpiry) <= new Date();

    // ✅ AUTO RESET EXPIRED PLAN
    if (isPlanExpired) {
      user.planId = null;
      user.planName = "Free";
      user.planExpiry = null;

      await user.save();
    }

    // ✅ CHECK ACTIVE PLAN
    const isPlanActive =
      !isAdmin &&
      user.planId &&
      user.planExpiry &&
      new Date(user.planExpiry) > new Date();

    // ✅ LOAD ACTIVE PLAN FEATURES
    if (isPlanActive) {
      const plan = await Plan.findById(user.planId);

      if (plan) {
        features = plan.features;
        activePlanName = plan.name;
        activePlanExpiry = user.planExpiry;
        activeProductType = plan.productType || "legacy";
      }
    }

    res.status(200).json({
      success: true,
      data: {

        // 👤 USER INFO
        _id: user._id,
        name: user.name || "",
        email: user.email || "",
        age: user.age || "",
        board: user.board || "",
        school: user.school || "",
        studentClass: user.studentClass || "",
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,

        // 🧠 ROLE
        role: user.role || "user",

        // 📦 ACTIVE PLAN INFO
        planName: isTeacher ? "Teacher" : activePlanName,
        planExpiry: activePlanExpiry,
        productType: isTeacher ? "teacher" : activeProductType,
        subscriptionScope: user.subscriptionScope || { board: "", subjects: [] },

        // 🔐 FEATURES
        features,
      },
    });

  } catch (err) {
    console.log("GET ME ERROR:", err);

    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};


// ✅ UPDATE USER PROFILE (SECURE)
exports.updateMe = async (req, res) => {
  try {
    const user = await getOrCreateUser(req);

    // ✅ ALLOWED FIELDS ONLY
    const allowedFields = [
      "name",
      "age",
      "board",
      "school",
      "studentClass",
    ];

    const updates = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    if (updates.board) {
      const boardExists = await Board.exists({ name: updates.board });
      if (!boardExists) {
        return res.status(400).json({ success: false, error: "Select a valid board." });
      }
    }

    if (updates.studentClass && !/^(?:[1-9]|1[0-2])$/.test(String(updates.studentClass))) {
      return res.status(400).json({ success: false, error: "Class must be between 1 and 12." });
    }

    if (updates.age !== undefined && updates.age !== "") {
      const age = Number(updates.age);
      if (!Number.isInteger(age) || age < 4 || age > 100) {
        return res.status(400).json({ success: false, error: "Enter a valid age." });
      }
      updates.age = age;
    }

    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      { $set: updates },
      {
        new: true,
        runValidators: true,
      }
    );

    res.status(200).json({
      success: true,
      data: updatedUser,
    });

  } catch (err) {
    console.log("UPDATE ME ERROR:", err);

    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};
