const mongoose = require("mongoose");

const uploadedFileSchema = new mongoose.Schema(
  {
    originalName: String,
    filename: String,
    path: String,
    mimeType: String,
    size: Number,
    url: String,
    publicId: String,
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
    submittedAt: { type: Date, default: Date.now },
    grade: { type: String, default: "", trim: true, maxlength: 80 },
    feedback: { type: String, default: "", trim: true, maxlength: 3000 },
    gradedBy: { type: String, default: "", trim: true, lowercase: true },
    gradedAt: Date,
  },
  { timestamps: true }
);

examSubmissionSchema.index({ assignment: 1, userEmail: 1 }, { unique: true });
examSubmissionSchema.index({ status: 1, updatedAt: -1 });

module.exports = mongoose.model("ExamSubmission", examSubmissionSchema);
