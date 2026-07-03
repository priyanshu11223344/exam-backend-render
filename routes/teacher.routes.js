const express = require("express");
const {
  getTeacherContext,
  createSession,
  updateSessionRemark,
  getStudentSessions,
  uploadTeacherQuestions,
} = require("../controllers/teacher.controller");

const router = express.Router();

router.get("/me", getTeacherContext);
router.post("/upload-questions", uploadTeacherQuestions);
router.post("/sessions", createSession);
router.put("/sessions/:sessionId/remarks", updateSessionRemark);
router.get("/student-sessions", getStudentSessions);

module.exports = router;
