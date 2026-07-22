// routes/admin.route.js

const express = require("express");
const router = express.Router();
const requireUser = require("../middleware/requireUser");
router.use(requireUser(["admin"]));
const multer = require("multer");

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const allowed = file.originalname.toLowerCase().endsWith(".xlsx");
    callback(allowed ? null : new Error("Only .xlsx workbooks are allowed."), allowed);
  },
});

const {
  getDashboardSummary,
  getUsers,
  updateUserByAdmin,
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
router.put("/users/:userId", updateUserByAdmin);
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
