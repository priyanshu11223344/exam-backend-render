const express = require("express");
const {
  getTeacherContext,
  createSession,
  updateSessionRemark,
  getStudentSessions,
} = require("../controllers/teacher.controller");

const router = express.Router();

router.get("/me", getTeacherContext);
router.post("/sessions", createSession);
router.put("/sessions/:sessionId/remarks", updateSessionRemark);
router.get("/student-sessions", getStudentSessions);

module.exports = router;
