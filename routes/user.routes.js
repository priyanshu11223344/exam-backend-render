// routes/userRoutes.js

const express = require("express");
const router = express.Router();

const { getMe,  updateMe } = require("../controllers/user.controller");
const { requireAuth } = require("@clerk/express");

const authMiddleware = process.env.CLERK_SECRET_KEY
  ? requireAuth()
  : (req, res, next) => {
      const origin = req.get("origin") || "";
      const isLocalRequest =
        origin === "http://localhost:5173" ||
        origin === "http://127.0.0.1:5173";

      if (isLocalRequest) {
        next();
        return;
      }

      res.status(503).json({
        success: false,
        error: "Clerk server authentication is not configured.",
      });
    };

router.get("/me", authMiddleware, getMe);
router.put("/update", authMiddleware, updateMe);

module.exports = router;
