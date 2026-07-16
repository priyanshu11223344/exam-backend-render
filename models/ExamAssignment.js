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

const examAssignmentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["quiz", "paper"],
      required: true,
    },
    board: {
      type: String,
      required: true,
      trim: true,
    },
    className: {
      type: String,
      required: true,
      trim: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    targetStudent: {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      name: {
        type: String,
        default: "",
        trim: true,
      },
      email: {
        type: String,
        default: "",
        trim: true,
        lowercase: true,
      },
    },
    instructions: {
      type: String,
      default: "",
    },
    dueAt: Date,
    durationMinutes: Number,
    quizConfig: {
      year: String,
      season: String,
      paperName: String,
      variant: String,
    },
    questionPaper: uploadedFileSchema,
    createdByRole: {
      type: String,
      enum: ["admin", "teacher"],
      default: "admin",
    },
    createdByEmail: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    status: {
      type: String,
      enum: ["draft", "published", "closed"],
      default: "published",
    },
  },
  { timestamps: true }
);

examAssignmentSchema.index({ board: 1, className: 1, subject: 1, status: 1 });
examAssignmentSchema.index({ "targetStudent.email": 1, status: 1 });

module.exports = mongoose.model("ExamAssignment", examAssignmentSchema);
