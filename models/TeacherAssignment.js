const mongoose = require("mongoose");

const assignedClassSchema = new mongoose.Schema(
  {
    className: {
      type: String,
      required: true,
      trim: true,
    },
    subjects: {
      type: [String],
      default: [],
    },
  },
  { _id: false }
);

const teacherAssignmentSchema = new mongoose.Schema(
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
    teacherName: {
      type: String,
      default: "Teacher",
    },
    board: {
      type: String,
      required: true,
      trim: true,
    },
    classes: {
      type: [assignedClassSchema],
      default: [],
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

teacherAssignmentSchema.index({ teacherEmail: 1, board: 1 }, { unique: true });

module.exports = mongoose.model("TeacherAssignment", teacherAssignmentSchema);
