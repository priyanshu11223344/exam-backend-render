// models/Board.js
const mongoose=require("mongoose");

const boardSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  }
}, { timestamps: true });
module.exports= mongoose.model("Board", boardSchema);
