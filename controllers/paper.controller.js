const Topic = require("../models/Topic");
const Subject = require("../models/Subject");
const Paper = require("../models/Paper");

exports.createPaper = async (req, res) => {
  try {
    const {
      topicId,
      year,
      season,
      paperName,
      variant,
      questionPaper,
      markScheme,
      explanation,
      specialComment,
    } = req.body;

    if (!topicId || !year || !season || !paperName || !variant) {
      return res.status(400).json({
        message: "Required fields are missing",
      });
    }

    const topic = await Topic.findById(topicId).select("subject name");

    if (!topic) {
      return res.status(404).json({
        message: "Topic not found",
      });
    }

    const paper = await Paper.create({
      topic: topicId,
      topicName: topic.name,
      year,
      season,
      paperName, // ✅ reference
      variant,   // ✅ separate field
      questionPaper,
      markScheme,
      explanation,
      specialComment,
    });

    console.log("Topic name being saved:", topic.name);

    await Topic.findByIdAndUpdate(topicId, {
      $inc: { numberOfPapers: 1 },
    });

    res.status(201).json({
      success: true,
      data: paper,
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: "Paper already exists for this combination",
      });
    }
    console.error(error);
  }
};

exports.getPapersByTopic = async (req, res) => {
  try {
    const { topicId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const papers = await Paper.find({ topic: topicId })
      .populate("paperName", "name") // ✅ FIXED
      .sort({ year: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Paper.countDocuments({ topic: topicId });

    res.status(200).json({
      success: true,
      page,
      totalPage: Math.ceil(total / limit),
      total,
      data: papers,
    });

  } catch (error) {
    console.error(error);
  }
};

exports.filterPapers = async (req, res) => {
  try {
    const {
      topicIds,
      years,
      seasons,
      paperName,
      variant,
    } = req.query;

    const filter = {};

    // Topics
    if (topicIds) {
      const topicArray = Array.isArray(topicIds)
        ? topicIds
        : topicIds.split(",");
      filter.topic = { $in: topicArray };
    }

    // Years
    if (years) {
      const yearArray = Array.isArray(years)
        ? years
        : years.split(",").map((y) => parseInt(y));
      filter.year = { $in: yearArray };
    }

    // Seasons
    if (seasons) {
      const seasonArray = Array.isArray(seasons)
        ? seasons
        : seasons.split(",");
      filter.season = { $in: seasonArray };
    }

    // PaperName (ObjectId)
    if (paperName) {
      const paperArray = Array.isArray(paperName)
        ? paperName
        : paperName.split(",");
      filter.paperName = { $in: paperArray };
    }

    // Variant (independent)
    if (variant) {
      const variantArray = Array.isArray(variant)
        ? variant.map((v) => parseInt(v))
        : variant.split(",").map((v) => parseInt(v));

      filter.variant = { $in: variantArray };
    }

    const papers = await Paper.find(filter)
      .populate("paperName", "name") // ✅ FIXED
      .sort({ year: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: papers.length,
      data: papers,
    });

  } catch (error) {
    console.error(error);
  }
};

exports.getPaperById = async (req, res) => {
  try {
    const paper = await Paper.findById(req.params.id)
      .populate({
        path: "topic",
        select: "name",
        populate: {
          path: "subject",
          select: "name",
          populate: {
            path: "board",
            select: "name",
          },
        },
      })
      .populate({
        path: "paperName",
        select: "name", // ✅ FIXED
      })
      .lean();

    if (!paper) {
      return res.status(404).json({
        message: "Paper not found",
      });
    }

    res.status(200).json({
      success: true,
      data: paper,
    });

  } catch (error) {
    console.error(error);
  }
};

exports.deletePaper = async (req, res) => {
  try {
    const paper = await Paper.findById(req.params.id);

    if (!paper) {
      return res.status(404).json({
        message: "Paper not found",
      });
    }

    const topic = await Topic.findById(paper.topic).select("subject");

    await paper.deleteOne();

    await Topic.findByIdAndUpdate(paper.topic, {
      $inc: { numberOfPapers: -1 },
    });

    await Subject.findByIdAndUpdate(topic.subject, {
      $inc: { numberOfPapers: -1 },
    });

    res.status(200).json({
      success: true,
      message: "Paper deleted successfully",
    });

  } catch (error) {
    console.error(error);
  }
};