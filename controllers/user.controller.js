// controllers/userController.js

const Plan = require("../models/Plan");
const getOrCreateUser = require("../utils/getOrCreateUser");
const User = require("../models/User");


// ✅ GET CURRENT USER (Dashboard Data)
exports.getMe = async (req, res) => {
  try {
    const user = await getOrCreateUser(req);

    // ✅ DEFAULT FREE FEATURES
    let features = ["topical"];

    // ✅ DEFAULT PLAN INFO
    let activePlanName = "Free";
    let activePlanExpiry = null;

    // ✅ CHECK IF PLAN EXPIRED
    const isPlanExpired =
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
      }
    }

    res.status(200).json({
      success: true,
      data: {

        // 👤 USER INFO
        name: user.name || "",
        email: user.email || "",
        age: user.age || "",
        board: user.board || "",
        school: user.school || "",
        studentClass: user.studentClass || "",

        // 🧠 ROLE
        role: user.role || "user",

        // 📦 ACTIVE PLAN INFO
        planName: activePlanName,
        planExpiry: activePlanExpiry,

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