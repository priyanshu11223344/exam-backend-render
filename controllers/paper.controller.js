const Topic = require("../models/Topic");
const Subject = require("../models/Subject");
const Paper = require("../models/Paper");
const getUserContext = require("../utils/getUserContext");
const assertSubscriptionScope = require("../utils/assertSubscriptionScope");
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

    // ✅ GET USER FEATURES
    const access = await getUserContext(req);
    const { features, isAdmin } = access;

    const topic = await Topic.findById(topicId).populate({ path: "subject", select: "name", populate: { path: "board", select: "name" } }).lean();
    if (!topic || !assertSubscriptionScope(access, topic.subject?.board?.name, topic.subject?.name)) {
      return res.status(403).json({ success: false, error: "This topic is outside your plan." });
    }

    let filter = { topic: topicId };

    // ✅ APPLY YEAR RESTRICTION
    if (!isAdmin && !features.includes("years_access")) {
      filter.year = { $lte: 2019 };
    }

    const papers = await Paper.find(filter)
      .populate("paperName", "name")
      .sort({ year: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Paper.countDocuments(filter);

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

    const access = await getUserContext(req);
    const { features, isAdmin } = access;

    const filter = {};

    // Topics
    if (topicIds) {
      const topicArray = Array.isArray(topicIds)
        ? topicIds
        : topicIds.split(",");
      filter.topic = { $in: topicArray };
      const scopedTopics = await Topic.find({ _id: { $in: topicArray } }).populate({ path: "subject", select: "name", populate: { path: "board", select: "name" } }).lean();
      if (scopedTopics.some((topic) => !assertSubscriptionScope(access, topic.subject?.board?.name, topic.subject?.name))) {
        return res.status(403).json({ success: false, error: "One or more selected topics are outside your plan." });
      }
    }

    // Years
    if (years) {
      const yearArray = Array.isArray(years)
        ? years
        : years.split(",").map((y) => parseInt(y));
      filter.year = { $in: yearArray };
    }

    // ❗ FORCE RESTRICTION
    if (!isAdmin && !features.includes("years_access")) {
      filter.year = { $lte: 2019 };
    }

    // Seasons
    if (seasons) {
      const seasonArray = Array.isArray(seasons)
        ? seasons
        : seasons.split(",");
      filter.season = { $in: seasonArray };
    }

    // PaperName
    if (paperName) {
      const paperArray = Array.isArray(paperName)
        ? paperName
        : paperName.split(",");
      filter.paperName = { $in: paperArray };
    }

    // Variant
    if (variant) {
      const variantArray = Array.isArray(variant)
        ? variant.map((v) => parseInt(v))
        : variant.split(",").map((v) => parseInt(v));

      filter.variant = { $in: variantArray };
    }

    const papers = await Paper.find(filter)
      .populate("paperName", "name")
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
    const access = await getUserContext(req);
    const { features, isAdmin } = access;

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
        select: "name",
      })
      .lean();

    if (!paper) {
      return res.status(404).json({
        message: "Paper not found",
      });
    }

    if (!assertSubscriptionScope(access, paper.topic?.subject?.board?.name, paper.topic?.subject?.name)) {
      return res.status(403).json({ success: false, message: "This paper is outside your plan." });
    }

    // 🔐 BLOCK ACCESS
    if (!isAdmin && !features.includes("years_access") && paper.year > 2019){
      return res.status(403).json({
        message: "Upgrade your plan to access this paper",
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
