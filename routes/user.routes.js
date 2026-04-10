// routes/userRoutes.js

const express = require("express");
const router = express.Router();

const { getMe,  updateMe } = require("../controllers/user.controller");
const { requireAuth } = require("@clerk/express");

// 🔐 Protected route
router.get("/me", requireAuth(), getMe);
router.put("/update",requireAuth(),updateMe)

module.exports = router;