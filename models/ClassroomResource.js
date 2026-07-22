const mongoose = require("mongoose");

const classroomResourceSchema = new mongoose.Schema(
  {
    teacherEmail: { type: String, required: true, trim: true, lowercase: true, index: true },
    teacherName: { type: String, default: "Teacher", trim: true },
    board: { type: String, required: true, trim: true },
    className: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, default: "", trim: true, maxlength: 2000 },
    driveUrl: { type: String, required: true, trim: true, maxlength: 2000 },
    deadline: { type: Date, required: true },
    status: { type: String, enum: ["published", "archived"], default: "published" },
  },
  { timestamps: true }
);

classroomResourceSchema.index({ board: 1, className: 1, subject: 1, status: 1, deadline: 1 });
classroomResourceSchema.index({ teacherEmail: 1, updatedAt: -1 });

module.exports = mongoose.model("ClassroomResource", classroomResourceSchema);
