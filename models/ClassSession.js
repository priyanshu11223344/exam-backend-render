const mongoose = require("mongoose");

const classSessionSchema = new mongoose.Schema(
  {
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    teacherEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    teacherName: String,
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
    title: {
      type: String,
      required: true,
      trim: true,
    },
    startsAt: {
      type: Date,
      required: true,
    },
    endsAt: Date,
    meetingLink: String,
    topicTaught: { type: String, default: "", trim: true, maxlength: 500 },
    specificComments: { type: String, default: "", trim: true, maxlength: 3000 },
    studentFeedback: { type: String, default: "", trim: true, maxlength: 3000 },
    status: {
      type: String,
      enum: ["scheduled", "completed", "cancelled"],
      default: "scheduled",
    },
    teacherRemark: {
      type: String,
      default: "",
    },
    teacherIssues: {
      type: String,
      default: "",
    },
    superadminNote: {
      type: String,
      default: "",
    },
    remarkUpdatedAt: Date,
  },
  { timestamps: true }
);

classSessionSchema.index({ teacherEmail: 1, startsAt: 1 });
classSessionSchema.index({ board: 1, className: 1, startsAt: 1 });

module.exports = mongoose.model("ClassSession", classSessionSchema);
