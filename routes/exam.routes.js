const express = require("express");
const multer = require("multer");
const {
  createAssignment,
  getAssignments,
  submitAnswerSheets,
  submitQuizResult,
} = require("../controllers/exam.controller");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.get("/assignments", getAssignments);
router.post("/assignments", upload.single("questionPaper"), createAssignment);
router.post(
  "/assignments/:assignmentId/answer-sheets",
  upload.array("answerSheets", 10),
  submitAnswerSheets
);
router.post("/assignments/:assignmentId/quiz-result", submitQuizResult);

module.exports = router;
