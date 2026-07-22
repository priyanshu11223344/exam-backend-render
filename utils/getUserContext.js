// utils/getUserContext.js

const Plan = require("../models/Plan");
const getOrCreateUser = require("./getOrCreateUser");

const getUserContext = async (req) => {
  const user = await getOrCreateUser(req);

  // ✅ ADMIN BYPASS
  if (user.role === "admin") {
    return {
      user,
      features: ["topical", "mcq", "pdf", "years_access"],
      isAdmin: true,
      productType: "complete",
      subscriptionScope: { board: "", subjects: [] },
    };
  }

  // ✅ DEFAULT FREE FEATURES
  let features = ["topical"];
  let productType = "free";

  // ✅ CHECK IF PLAN EXPIRED
  const isPlanExpired =
    user.planExpiry &&
    new Date(user.planExpiry) <= new Date();

  // ✅ AUTO RESET EXPIRED PLAN
  if (isPlanExpired) {
    user.planId = null;
    user.planName = "Free";
    user.planExpiry = null;

    await user.save();
  }

  // ✅ CHECK ACTIVE PLAN
  const isPlanActive =
    user.planId &&
    user.planExpiry &&
    new Date(user.planExpiry) > new Date();

  // ✅ LOAD FEATURES
  if (isPlanActive) {
    const plan = await Plan.findById(user.planId);

    if (plan) {
      features = plan.features;
      productType = plan.productType || "legacy";
    }
  }

  return {
    user,
    features,
    isAdmin: false,
    productType,
    subscriptionScope: user.subscriptionScope || { board: "", subjects: [] },
  };
};

module.exports = getUserContext;
