// controllers/paymentController.js

const razorpay = require("../config/razorpay");
const Plan = require("../models/Plan");
const User = require("../models/User");
const crypto = require("crypto");
const getOrCreateUser = require("../utils/getOrCreateUser");

const isLocalPaymentRequest = (req) => {
  const origin = req.get("origin") || "";
  const clientOrigin = process.env.CLIENT_ORIGIN || "";

  return [origin, clientOrigin].some((value) =>
    value.includes("localhost") || value.includes("127.0.0.1")
  );
};

const activatePlanForLocalUser = async ({ req, plan, selectedDuration }) => {
  const userInfo = req.body.user || {};
  const auth = typeof req.auth === "function" ? req.auth() : {};
  const clerkId = auth?.userId || userInfo.clerkId;
  const email = userInfo.email;
  const purchaseScope = req.body.purchaseScope || {};

  if (!clerkId && !email) {
    return null;
  }

  const expiry = new Date(
    Date.now() + selectedDuration.durationDays * 24 * 60 * 60 * 1000
  );

  return User.findOneAndUpdate(
    clerkId ? { clerkId } : { email },
    {
      $set: {
        clerkId: clerkId || email,
        email: email || "",
        name: userInfo.name || "Local Admin",
        planId: plan._id,
        planName: plan.name,
        planExpiry: expiry,
        subscriptionScope: {
          board: String(purchaseScope.board || "").trim(),
          subjects: Array.isArray(purchaseScope.subjects) ? purchaseScope.subjects.map(String) : [],
        },
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );
};


// ✅ CREATE ORDER


exports.createOrder = async (req, res) => {
  try {
    const { planId, duration, purchaseScope = {} } = req.body;

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

    if (plan.scopeType !== "none" && !String(purchaseScope.board || "").trim()) {
      return res.status(400).json({ error: "Select a board for this plan." });
    }
    if (plan.scopeType === "board_subject" && !purchaseScope.subjects?.length) {
      return res.status(400).json({ error: "Select at least one subject for this plan." });
    }

    const amount = selectedDuration.price * 100; // Razorpay uses paise

    if (!razorpay) {
      if (!isLocalPaymentRequest(req)) {
        return res.status(503).json({
          success: false,
          error: "Payment gateway is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET before enabling hosted upgrades.",
        });
      }

      const user = await activatePlanForLocalUser({
        req,
        plan,
        selectedDuration,
      });

      return res.json({
        success: true,
        localPaymentBypass: true,
        message: user
          ? "Local payment bypass enabled. Plan activated for this local test user."
          : "Local payment bypass enabled. No user record was updated because user details were unavailable.",
        planName: plan.name,
        planExpiry: user?.planExpiry || null,
      });
    }

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
      durationLabel,
      purchaseScope = {},
    } = req.body;

    // 🔐 Verify signature
    if (!razorpay || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(503).json({
        error: "Payment verification requires Razorpay keys.",
      });
    }

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
    user.subscriptionScope = {
      board: String(purchaseScope.board || "").trim(),
      subjects: Array.isArray(purchaseScope.subjects) ? purchaseScope.subjects.map(String) : [],
    };

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
