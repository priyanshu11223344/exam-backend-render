const PaperName = require("../models/PaperName");

// ✅ CREATE
exports.createPaperName = async (req, res) => {
  try {
    const { name, subjectId } = req.body;

    const newPaper = new PaperName({
      name,
      subjectId,
    });

    await newPaper.save();

    res.status(201).json({
      success: true,
      data: newPaper,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// ✅ GET
exports.getPaperNamesBySubject = async (req, res) => {
  try {
    const { subjectId } = req.params;

    const papers = await PaperName.find({ subjectId });

    res.status(200).json({
      success: true,
      data: papers,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};