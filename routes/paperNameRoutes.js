// routes/paperNameRoutes.js

const express = require("express");
const router = express.Router();
const requireUser = require("../middleware/requireUser");
const requireAdminPermission = require("../middleware/requireAdminPermission");

const {
  createPaperName,
  getPaperNamesBySubject,
} = require("../controllers/paperNameController");

router.post("/create", requireUser(["admin", "staff"]), requireAdminPermission("content", "questions"), createPaperName);
router.get("/:subjectId", getPaperNamesBySubject);

module.exports = router;
