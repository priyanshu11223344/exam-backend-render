const mongoose = require("mongoose");

const uploadedFileSchema = new mongoose.Schema(
  {
    originalName: String,
    filename: String,
    path: String,
    mimeType: String,
    size: Number,
  },
  { _id: false }
);

const examSubmissionSchema = new mongoose.Schema(
  {
    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExamAssignment",
      required: true,
    },
    userEmail: {
      type: String,
      required: true,
      trim: true,
    },
    userName: String,
    answerSheets: {
      type: [uploadedFileSchema],
      default: [],
    },
    quizResult: {
      score: Number,
      total: Number,
      answers: Object,
    },
    status: {
      type: String,
      enum: ["submitted", "graded"],
      default: "submitted",
    },
  },
  { timestamps: true }
);

examSubmissionSchema.index({ assignment: 1, userEmail: 1 }, { unique: true });

module.exports = mongoose.model("ExamSubmission", examSubmissionSchema);
