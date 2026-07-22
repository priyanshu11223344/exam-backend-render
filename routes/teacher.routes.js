const express = require("express");
const {
  getTeacherContext,
  createSession,
  updateSessionRemark,
  getStudentSessions,
  uploadTeacherQuestions,
  getStudentWorkspace,
} = require("../controllers/teacher.controller");

const router = express.Router();
const requireUser = require("../middleware/requireUser");

router.get("/me", requireUser(["teacher", "admin"]), getTeacherContext);
router.post("/upload-questions", requireUser(["teacher", "admin"]), uploadTeacherQuestions);
router.post("/sessions", requireUser(["teacher", "admin"]), createSession);
router.put("/sessions/:sessionId/remarks", requireUser(["teacher", "admin"]), updateSessionRemark);
router.get("/student-sessions", requireUser(), getStudentSessions);
router.get("/student-workspace", requireUser(["user", "admin"]), getStudentWorkspace);

module.exports = router;
