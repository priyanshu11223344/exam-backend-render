// models/Topic.js
const mongoose=require("mongoose");

const topicSchema = new mongoose.Schema({
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subject",
    required: [true,"Subject reference is required"],
  },
  name: {
    type: String,
    required: [true,"Topic name is required"]
  }
}, { timestamps: true });
topicSchema.index({ subject: 1, name: 1 }, { unique: true });

// 🔥 Fast lookup by subject
topicSchema.index({ subject: 1 });
module.exports= mongoose.model("Topic", topicSchema);
