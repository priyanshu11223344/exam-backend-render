// models/User.js

const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: String,
  email: String,

  clerkId: {
    type: String,
    required: true,
    unique: true
  },
  role: {
    type: String,
    enum: ["admin", "teacher", "user"],
    default: "user"
  },
  age:Number,
  board:String,
  school:String,
  studentClass:String,
  profileCompletedAt: {
    type: Date,
    default: null
  },
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Plan",
    default: null
  },

  planName: {
    type: String,
    default: "Free"
  },

  planExpiry: {
    type: Date,
    default: null
  },

  subscriptionScope: {
    board: { type: String, default: "", trim: true },
    subjects: { type: [String], default: [] }
  }

}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
