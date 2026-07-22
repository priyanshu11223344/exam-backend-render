// routes/admin.route.js

const express = require("express");
const router = express.Router();
const requireUser = require("../middleware/requireUser");
const requireAdminPermission = require("../middleware/requireAdminPermission");
router.use(requireUser(["admin", "staff"]));
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
  createUserByAdmin,
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

router.get(
  "/dashboard-summary",
  requireAdminPermission("overview", "content", "questions", "assignments", "teachers", "remarks", "students", "plans", "links", "users_manage"),
  getDashboardSummary
);
router.get("/users", requireAdminPermission("students", "teachers", "users_manage"), getUsers);
router.post("/users", requireAdminPermission("users_manage"), createUserByAdmin);
router.put("/users/:userId", requireAdminPermission("students", "users_manage"), updateUserByAdmin);
router.get("/teachers", requireAdminPermission("teachers", "assignments", "users_manage"), getAdminTeachers);
router.post("/teachers/assign", requireAdminPermission("teachers"), assignTeacher);
router.get("/teacher-remarks", requireAdminPermission("remarks"), getAdminRemarks);
router.put("/teacher-remarks/:sessionId", requireAdminPermission("remarks"), updateSuperadminNote);
router.post("/upload-excel", requireAdminPermission("questions"), upload.single("file"), uploadExcel);
router.post(
    "/upload-questions-form",
    requireAdminPermission("questions"),
    uploadQuestionsByForm
  );
module.exports = router;
