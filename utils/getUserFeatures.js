// utils/getUserFeatures.js

const Plan = require("../models/Plan");
const getOrCreateUser = require("./getOrCreateUser");

const getUserFeatures = async (req) => {
  const user = await getOrCreateUser(req);

  let features = ["topical"];

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
    }
  }

  return {
    user,
    features,
  };
};

module.exports = getUserFeatures;