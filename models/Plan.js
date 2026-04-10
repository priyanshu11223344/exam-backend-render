// models/Plan.js

const mongoose = require("mongoose");

const planSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },

  features: [
    {
      type: String,
      required: true
    }
  ],

  durations: [
    {
      label: {
        type: String, // "1m", "6m", "12m"
        required: true
      },
      price: {
        type: Number,
        required: true
      },
      durationDays: {
        type: Number,
        required: true
      }
    }
  ],

  isActive: {
    type: Boolean,
    default: true
  }

}, { timestamps: true });

module.exports = mongoose.model("Plan", planSchema);