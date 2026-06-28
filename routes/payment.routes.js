// routes/paymentRoutes.js

const express = require("express");
const router = express.Router();

const {
  createOrder,
  verifyPayment
} = require("../controllers/payment.controller");
const { requireAuth } = require("@clerk/express");
const authMiddleware = process.env.CLERK_SECRET_KEY
  ? requireAuth()
  : (req, res, next) => next();

router.post("/create-order", authMiddleware, createOrder);
router.post("/verify-payment", authMiddleware, verifyPayment);

module.exports = router;
