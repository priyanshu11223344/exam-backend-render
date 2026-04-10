// controllers/paymentController.js

const razorpay = require("../config/razorpay");
const Plan = require("../models/Plan");
const crypto = require("crypto");
const getOrCreateUser = require("../utils/getOrCreateUser");


// ✅ CREATE ORDER


exports.createOrder = async (req, res) => {
  try {
    const { planId, duration } = req.body;

    if (!planId || !duration) {
      return res.status(400).json({ error: "Missing planId or duration" });
    }

    const plan = await Plan.findById(planId);

    if (!plan) {
      return res.status(404).json({ error: "Plan not found" });
    }

    const selectedDuration = plan.durations.find(
      (d) => d.label === duration
    );

    if (!selectedDuration) {
      return res.status(400).json({ error: "Invalid duration" });
    }

    const amount = selectedDuration.price * 100; // Razorpay uses paise

    // 🔥 Create Razorpay order here
    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
    });

    res.json({
      orderId: order.id,
      amount,
      key: process.env.RAZORPAY_KEY_ID,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};


// ✅ VERIFY PAYMENT (CLERK INTEGRATED)
exports.verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      planId,
      durationLabel
    } = req.body;

    // 🔐 Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expected !== razorpay_signature) {
      return res.status(400).json({
        error: "Payment verification failed"
      });
    }

    // 👤 Get or create user (Clerk)
    const user = await getOrCreateUser(req);

    // 📦 Get plan
    const plan = await Plan.findById(planId);

    const duration = plan.durations.find(
      (d) => d.label === durationLabel
    );

    // ⏳ Calculate expiry
    const expiry = new Date(
      Date.now() + duration.durationDays * 24 * 60 * 60 * 1000
    );

    // 💾 Update user
    user.planId = plan._id;
    user.planName = plan.name;
    user.planExpiry = expiry;

    await user.save();

    res.json({
      success: true,
      message: "Plan activated successfully"
    });

  } catch (err) {
    console.log("VERIFY ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};