const express = require("express");
const router = express.Router();
const requireUser = require("../middleware/requireUser");
const requireAdminPermission = require("../middleware/requireAdminPermission");

const {
  createPaper,
  getPapersByTopic,
  filterPapers,
  getPaperById,
  deletePaper,
} = require("../controllers/paper.controller");

// Create paper
router.post("/", requireUser(["admin", "staff"]), requireAdminPermission("questions"), createPaper);

// Get papers under topic (paginated)
router.get("/topic/:topicId", getPapersByTopic);

// Advanced filter
router.get("/filter", filterPapers);

// Get single paper
router.get("/:id", getPaperById);

// Delete paper
router.delete("/:id", requireUser(["admin", "staff"]), requireAdminPermission("questions"), deletePaper);

module.exports = router;
