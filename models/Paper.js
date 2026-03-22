// models/Paper.js
const mongoose=require("mongoose");
const fileSchema = new mongoose.Schema({
  fileType: {
    type: String,
    enum: ["link", "image", "pdf"],
    required: true,
  },
  url: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "done", "failed"],
    default: "pending"
  }
}, { _id: false });
const paperSchema = new mongoose.Schema({
  topic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Topic",
    required: true
  },
  topicName:{
    type:String
  },
  year: {
    type: Number,
    required: true
  },

  season: {
    type: String,
    enum: ["Winter", "Summer", "Spring", "Fall"],
    required: true
  },

  paperNumber: {
    type: Number,
    required: true
  },

  variant: {
    type: Number,
    required: true
  },

  questionPaper: {
  type: [fileSchema],
  required: true
},

markScheme: {
  type: [fileSchema]
},

explanation: {
  type: fileSchema
},

specialComment: {
  type: fileSchema
},


}, { timestamps: true });
// 🔥 Prevent duplicate paper inside same topic
paperSchema.index(
  { topic: 1, year: 1, season: 1, paperNumber: 1, variant: 1 },
  { unique: true }
);

// 🔥 Fast filtering
paperSchema.index({ topic: 1, year: 1 });

module.exports= mongoose.model("Paper", paperSchema);
