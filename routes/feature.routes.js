// routes/featureRoutes.js

const express = require("express");
const router = express.Router();

const requireFeature = require("../middleware/requireFeature");
const { requireAuth } = require("@clerk/express");

// ✅ Free + Paid
router.get(
  "/topical",
  requireAuth(),
  requireFeature("topical"),
  (req, res) => {
    res.send("Topical Questions");
  }
);

// 🔒 Paid only
router.get(
  "/mcq",
  requireAuth(),
  requireFeature("mcq"),
  (req, res) => {
    res.send("MCQ Questions");
  }
);

router.get(
  "/pdf",
  requireAuth(),
  requireFeature("pdf"),
  (req, res) => {
    res.send("PDF Generation");
  }
);

module.exports = router;