// routes/admin.route.js

const express = require("express");
const router = express.Router();
const multer = require("multer");

const upload = multer({ dest: "uploads/" });

const {
  getDashboardSummary,
  getUsers,
  uploadExcel,
  uploadQuestionsByForm,
} = require("../controllers/admin.controller");
const {
  assignTeacher,
  getAdminTeachers,
  getAdminRemarks,
  updateSuperadminNote,
} = require("../controllers/teacher.controller");

router.get("/dashboard-summary", getDashboardSummary);
router.get("/users", getUsers);
router.get("/teachers", getAdminTeachers);
router.post("/teachers/assign", assignTeacher);
router.get("/teacher-remarks", getAdminRemarks);
router.put("/teacher-remarks/:sessionId", updateSuperadminNote);
router.post("/upload-excel", upload.single("file"), uploadExcel);
router.post(
    "/upload-questions-form",
    uploadQuestionsByForm
  );
module.exports = router;
