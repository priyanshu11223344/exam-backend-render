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

  productType: {
    type: String,
    enum: ["topical", "test_series", "complete", "topical_builder", "legacy"],
    default: "legacy",
    index: true
  },

  scopeType: {
    type: String,
    enum: ["board", "board_subject", "none"],
    default: "none"
  },

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
