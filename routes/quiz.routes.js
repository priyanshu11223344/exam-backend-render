const mongoose = require("mongoose");

const paperNameSchema = new mongoose.Schema({
  subjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subject",
    required: [true, "Subject reference is required"],
  },

  name: {
    type: String,
    required: [true, "Paper name is required"],
    trim: true,
  },

  // 🔥 ADD THIS (CRITICAL)
  

}, { timestamps: true });

// ✅ Prevent duplicate (same paper + variant)
paperNameSchema.index(
  { subjectId: 1, name: 1 },
  { unique: true }
);

// 🔥 Fast lookup
paperNameSchema.index({ subjectId: 1 });

module.exports = mongoose.model("PaperName", paperNameSchema);