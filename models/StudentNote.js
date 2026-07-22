const mongoose = require("mongoose");

const studentNoteSchema = new mongoose.Schema(
  {
    teacherEmail: { type: String, required: true, trim: true, lowercase: true, index: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    studentEmail: { type: String, required: true, trim: true, lowercase: true },
    board: { type: String, required: true, trim: true },
    className: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    comment: { type: String, required: true, trim: true, maxlength: 3000 },
  },
  { timestamps: true }
);

studentNoteSchema.index({ student: 1, subject: 1, createdAt: -1 });
studentNoteSchema.index({ teacherEmail: 1, className: 1, subject: 1, createdAt: -1 });

module.exports = mongoose.model("StudentNote", studentNoteSchema);
