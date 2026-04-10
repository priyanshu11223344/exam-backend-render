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
  age:Number,
  board:String,
  school:String,
  studentClass:String,
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
  }

}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);