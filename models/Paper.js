const mongoose = require("mongoose");

/* ===============================
   FILE SCHEMA (UPDATED)
================================= */
const fileSchema = new mongoose.Schema(
  {
    fileType: {
      type: String,
      enum: ["link", "image", "pdf"],
      required: true,
    },

    // 🔥 ORIGINAL (IDENTITY - NEVER CHANGE)
    originalUrl: {
      type: String,
      required: true,
    },

    // 🔥 PROCESSED (CLOUDINARY)
    cloudinaryUrl: {
      type: String,
      default: null,
    },

    status: {
      type: String,
      enum: ["pending", "done", "failed"],
      default: "pending",
    },

    // 🔥 OPTIONAL (future-proof)
    retries: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

/* ===============================
   MAIN SCHEMA
================================= */
const paperSchema = new mongoose.Schema(
  {
    topic: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Topic",
      required: true,
    },

    topicName: {
      type: String,
    },

    year: {
      type: Number,
      required: true,
    },

    season: {
      type: String,
      enum: ["Winter", "Summer", "Spring", "Fall"],
      required: true,
    },

    paperNumber: {
      type: Number,
      required: true,
    },

    variant: {
      type: Number,
      required: true,
    },

    questionNumber: {
      type: Number,
      required: true,
    },

    questionPaper: {
      type: [fileSchema],
      required: true,
    },

    markScheme: {
      type: [fileSchema],
      default: [],
    },

    explanation: {
      type: fileSchema,
    },

    specialComment: {
      type: fileSchema,
    },
  },
  { timestamps: true }
);

/* ===============================
   INDEXES
================================= */

// 🔥 Prevent duplicate paper
paperSchema.index(
  {
    topic: 1,
    year: 1,
    season: 1,
    paperNumber: 1,
    variant: 1,
    questionNumber: 1,
  },
  { unique: true }
);

// 🔥 Fast filtering
paperSchema.index({ topic: 1, year: 1 });

// 🔥 VERY IMPORTANT (background job speed)
paperSchema.index({ "questionPaper.status": 1 });
paperSchema.index({ "markScheme.status": 1 });

module.exports = mongoose.model("Paper", paperSchema);