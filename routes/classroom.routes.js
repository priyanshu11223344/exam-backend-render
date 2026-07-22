const express = require("express");
const controller = require("../controllers/classroom.controller");
const requireUser = require("../middleware/requireUser");

const router = express.Router();
router.get("/resources", requireUser(), controller.getResources);
router.post("/resources", requireUser(["teacher", "admin"]), controller.createResource);
router.delete("/resources/:resourceId", requireUser(["teacher", "admin"]), controller.archiveResource);
router.get("/student-notes", requireUser(["teacher", "admin"]), controller.getStudentNotes);
router.post("/student-notes", requireUser(["teacher", "admin"]), controller.addStudentNote);
router.get("/submissions", requireUser(["teacher", "admin"]), controller.getTeacherSubmissions);
router.put("/submissions/:submissionId/grade", requireUser(["teacher", "admin"]), controller.gradeSubmission);

module.exports = router;
