// controllers/userController.js

const Plan = require("../models/Plan");
const getOrCreateUser = require("../utils/getOrCreateUser");
const User = require("../models/User");

// ✅ GET CURRENT USER (Dashboard Data)
exports.getMe = async (req, res) => {
  try {
    const user = await getOrCreateUser(req);

    let features = ["topical"]; // default free feature

    // ✅ Check active plan
    if (
      user.planId &&
      user.planExpiry &&
      new Date(user.planExpiry) > new Date()
    ) {
      const plan = await Plan.findById(user.planId);

      if (plan) {
        features = plan.features;
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
      
        // 🧠 ROLE (🔥 ADD THIS LINE)
        role: user.role || "user",
      
        // 📦 PLAN INFO
        planName: user.planName || "Free",
        planExpiry: user.planExpiry || null,
      
        // 🔐 FEATURES
        features
      }
    });

  } catch (err) {
    console.log("GET ME ERROR:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

// ✅ UPDATE USER PROFILE (SECURE)
exports.updateMe = async (req, res) => {
  try {
    const user = await getOrCreateUser(req);

    // ✅ Only allow safe fields
    const allowedFields = ["name", "age", "board", "school", "studentClass"];

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
        runValidators: true
      }
    );

    res.status(200).json({
      success: true,
      data: updatedUser
    });

  } catch (err) {
    console.log("UPDATE ME ERROR:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};