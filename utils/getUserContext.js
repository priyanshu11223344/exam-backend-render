// utils/getUserContext.js

const Plan = require("../models/Plan");
const getOrCreateUser = require("./getOrCreateUser");

const getUserContext = async (req) => {
  const user = await getOrCreateUser(req);

  // ✅ ADMIN → full access
  if (user.role === "admin") {
    return {
      user,
      features: [],
      isAdmin: true,
    };
  }

  let features = ["topical"];

  // 🔥 subscription check
  if (
    user.planId &&
    user.planExpiry &&
    new Date(user.planExpiry) > new Date()
  ) {
    const plan = await Plan.findById(user.planId);
    if (plan) {
      features = plan.features;
    }
  }

  return {
    user,
    features,
    isAdmin: false,
  };
};

module.exports = getUserContext;