const Plan = require("../models/Plan");
const getOrCreateUser = require("./getOrCreateUser");

const getUserFeatures = async (req) => {
  const user = await getOrCreateUser(req);

  let features = ["topical"];

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

  return { user, features };
};

module.exports = getUserFeatures;