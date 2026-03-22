const Topic = require("../models/Topic");
const Subject = require("../models/Subject");


// ✅ Create Topic
exports.createTopic = async (req, res) => {
  try {
    const { subjectId, name } = req.body;

    if (!subjectId || !name) {
      return res.status(400).json({
        message: "Subject ID and Topic name are required",
      });
    }

    // 1️⃣ Check if subject exists
    const subjectExists = await Subject.findById(subjectId).select("_id");

    if (!subjectExists) {
      return res.status(404).json({
        message: "Subject not found",
      });
    }

    // 2️⃣ Create topic
    const topic = await Topic.create({
      subject: subjectId,
      name,
    });

    res.status(201).json({
      success: true,
      data: topic,
    });

  } catch (error) {

    // Duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        message: "Topic already exists in this subject",
      });
    }
    console.error(error)

   
  }
};



// ✅ Get Topics By Subject
exports.getTopicsBySubject = async (req, res) => {
  try {
    const { subjectId } = req.params;

    const topics = await Topic.find({ subject: subjectId })
      .select("name  createdAt")
      .lean();

    res.status(200).json({
      success: true,
      count: topics.length,
      data: topics,
    });
  } catch (error) {
    console.error(error);
  }
};



// ✅ Get Single Topic
exports.getTopicById = async (req, res) => {
  try {
    const topic = await Topic.findById(req.params.id)
      .populate("subject", "name")
      .lean();

    if (!topic) {
      return res.status(404).json({
        message: "Topic not found",
      });
    }

    res.status(200).json({
      success: true,
      data: topic,
    });
  } catch (error) {
    console.error(error);
  }
};



// ✅ Delete Topic
exports.deleteTopic = async (req, res) => {
  try {
    const topic = await Topic.findByIdAndDelete(req.params.id);

    if (!topic) {
      return res.status(404).json({
        message: "Topic not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Topic deleted successfully",
    });
  } catch (error) {
    console.error(error);
  }
};
