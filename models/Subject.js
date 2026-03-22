// models/Subject.js
const mongoose=require("mongoose");

const subjectSchema = new mongoose.Schema({
  board: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Board",
    required: [true,"reference is required"],
  },
  name: {
    type: String,
    required: [true,"Subject name is required"],
  },
  numberOfPapers: {
    type: Number,
    default: 0
  }
}, { timestamps: true });
// 🔥 Prevent duplicate subject inside same board
subjectSchema.index({ board: 1, name: 1 }, { unique: true });

// 🔥 Fast lookup by board
subjectSchema.index({ board: 1 });


module.exports= mongoose.model("Subject", subjectSchema);
