const express = require("express");
const multer = require("multer");
const {
  createAssignment,
  getAssignments,
  submitAnswerSheets,
  submitQuizResult,
  getMySubmissions,
} = require("../controllers/exam.controller");

const router = express.Router();
const requireUser = require("../middleware/requireUser");
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 15 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, callback) => {
    const allowed = file.mimetype === "application/pdf" || file.mimetype.startsWith("image/");
    callback(allowed ? null : new Error("Only PDF and image files are allowed."), allowed);
  },
});

router.get("/assignments", getAssignments);
router.post("/assignments", requireUser(["admin", "teacher"]), upload.single("questionPaper"), createAssignment);
router.get("/submissions", requireUser(), getMySubmissions);
router.post(
  "/assignments/:assignmentId/answer-sheets",
  requireUser(),
  upload.array("answerSheets", 10),
  submitAnswerSheets
);
router.post("/assignments/:assignmentId/quiz-result", submitQuizResult);

module.exports = router;
