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

    if (
      !board ||
      !subject ||
      !year ||
      !season ||
      !paperName ||
      !variant
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    /* ===============================
       STEP 2: FIND BOARD
    ================================= */

    const boardDoc = await Board.findOne({
      name: board,
    });

    if (!boardDoc) {
      return res.status(404).json({
        success: false,
        message: "Board not found",
      });
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
       STEP 4: NORMALIZE INPUTS
    ================================= */

    // YEARS
    const yearArray =
      typeof year === "string"
        ? year.split(",").map(Number)
        : year;

    // SEASONS
    const seasonArray =
      typeof season === "string"
        ? season.split(",").map((s) => s.trim())
        : season;

    // PAPER NAMES
    const paperNameArray =
      typeof paperName === "string"
        ? paperName.split(",").map((p) => p.trim())
        : paperName;

    // VARIANTS
    const variantArray =
      typeof variant === "string"
        ? variant.split(",").map(Number)
        : variant;

    /* ===============================
       STEP 5: FIND PAPER NAMES
    ================================= */

    const paperNameDocs = await PaperName.find({
      subjectId: subjectDoc._id,
      name: {
        $in: paperNameArray,
      },
    });

    if (!paperNameDocs.length) {
      return res.status(404).json({
        success: false,
        message: "Paper not found",
      });
    }

    /* ===============================
       STEP 6: BUILD QUERY
    ================================= */

    const query = {
      paperName: {
        $in: paperNameDocs.map(
          (p) => p._id
        ),
      },

      variant: {
        $in: variantArray,
      },

      year: {
        $in: yearArray,
      },

      season: {
        $in: seasonArray,
      },

      isMCQ: true,
    };

    /* ===============================
       STEP 7: FETCH QUESTIONS
    ================================= */

    const questions = await Paper.find(query)
      .populate("paperName", "name")
      .sort({
        year: -1,
        questionNumber: 1,
      });

    /* ===============================
       RESPONSE
    ================================= */

    res.json({
      success: true,
      count: questions.length,
      questions,
    });

  } catch (error) {

    console.log("QUIZ ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};