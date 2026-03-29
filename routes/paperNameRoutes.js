// routes/paperNameRoutes.js

const express = require("express");
const router = express.Router();

const {
  createPaperName,
  getPaperNamesBySubject,
} = require("../controllers/paperNameController");

router.post("/create", createPaperName);
router.get("/:subjectId", getPaperNamesBySubject);

module.exports = router;