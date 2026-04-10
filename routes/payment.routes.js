// routes/paymentRoutes.js

const express = require("express");
const router = express.Router();

const {
  createOrder,
  verifyPayment
} = require("../controllers/payment.controller");
const { requireAuth } = require("@clerk/express");
// ⚠️ Add auth middleware later
router.post("/create-order",requireAuth(), createOrder);
router.post("/verify-payment",requireAuth(), verifyPayment);

module.exports = router;