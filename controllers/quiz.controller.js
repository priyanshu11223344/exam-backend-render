const Board = require("../models/Board");
const Subject = require("../models/Subject");
const Paper = require("../models/Paper");
const PaperName = require("../models/PaperName");

exports.getQuizQuestions = async (req, res) => {
  try {
    const {
      board,
      subject,
      year,
      season,
      paperName,
      variant,
    } = req.query;
    /* ===============================
STEP 1: VALIDATION
================================= */
    if (!board ||
      !subject ||
      !year ||
      !season ||
      !paperName ||
      !variant) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }
    /* ===============================
STEP 2: FIND BOARD
================================= */
    const boardDoc = await Board.findOne({ name: board });
    if (!boardDoc) {
      return res.status(404).json({
        success: false,
        message: "Board not found",
      })
    }
    /* ===============================
       STEP 3: FIND SUBJECT
    ================================= */
    const subjectDoc = await Subject.findOne({
      name: subject,
      board: boardDoc._id,
    });

    if (!subjectDoc) {
      return res.status(404).json({
        success: false,
        message: "Subject not found",
      });
    }

    /* ===============================
       STEP 4: FIND PAPER NAME
    ================================= */
    const paperNameDoc = await PaperName.findOne({
      subjectId: subjectDoc._id,
      name: paperName,
    });

    if (!paperNameDoc) {
      return res.status(404).json({
        success: false,
        message: "Paper not found",
      });
    }

    /* ===============================
       STEP 5: FETCH MCQ QUESTIONS
    ================================= */
    const query = {
      paperName: paperNameDoc._id,
      variant,
      isMCQ: true,
    };
    
    // ✅ Normalize inputs
    const yearArray =
      typeof year === "string"
        ? year.split(",").map(Number)
        : year;
    
    const seasonArray =
      typeof season === "string"
        ? season.split(",")
        : season;
    
    // ✅ Always use $in
    query.year = { $in: yearArray };
    query.season = { $in: seasonArray };
    
    // 🔥 Final query
    const questions = await Paper.find(query)
      .populate("paperName", "name")
      .sort({ questionNumber: 1 });

    /* ===============================
       RESPONSE
    ================================= */
    res.json({
      success: true,
      count: questions.length,
      questions,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};



