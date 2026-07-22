const Board = require("../models/Board");
const Subject = require("../models/Subject");
const Paper = require("../models/Paper");
const PaperName = require("../models/PaperName");
const getUserContext = require("../utils/getUserContext");
const assertSubscriptionScope = require("../utils/assertSubscriptionScope");
const ExamAssignment = require("../models/ExamAssignment");

exports.getQuizQuestions = async (req, res) => {
  try {
    let {
      board,
      subject,
      year,
      season,
      paperName,
      variant,
    } = req.query;
    const assignmentId = req.query.assignmentId;
    const access = await getUserContext(req);
    let assignedAccess = false;

    if (assignmentId) {
      const assignment = await ExamAssignment.findById(assignmentId).lean();
      const user = access.user;
      const isTargetStudent = !assignment?.targetStudent?.email || assignment.targetStudent.email === String(user.email || "").toLowerCase();
      const isClassMember = assignment?.audience === "class" && assignment.board === user.board && String(assignment.className) === String(user.studentClass);
      const isSubscriber = assignment?.audience === "subscribers" && assignment.board === user.subscriptionScope?.board && (user.subscriptionScope?.subjects || []).includes(assignment.subject);
      assignedAccess = Boolean(assignment && assignment.type === "quiz" && assignment.status === "published" && isTargetStudent && (isClassMember || isSubscriber));
      if (!assignedAccess) return res.status(403).json({ success: false, message: "This test is not assigned to your account." });
      if (assignment.dueAt && new Date(assignment.dueAt) < new Date()) return res.status(409).json({ success: false, message: "The test deadline has passed." });
      board = assignment.board;
      subject = assignment.subject;
      year = assignment.quizConfig?.year;
      season = assignment.quizConfig?.season;
      paperName = assignment.quizConfig?.paperName;
      variant = assignment.quizConfig?.variant;
    }

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

    if (!assignedAccess && !access.isAdmin && !access.features.includes("mcq")) {
      return res.status(403).json({ success: false, message: "Your plan does not include MCQ tests." });
    }
    if (!assignedAccess && !assertSubscriptionScope(access, board, subject)) {
      return res.status(403).json({ success: false, message: "This board or subject is outside your plan." });
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
