const Plan = require("../models/Plan");
const getOrCreateUser = require("../utils/getOrCreateUser");

const requireFeature = (feature) => {
  return async (req, res, next) => {
    try {
      const user = await getOrCreateUser(req);

      // 🔥 Expiry check
      if (user.planExpiry && new Date() > user.planExpiry) {
        user.planId = null;
        user.planName = "Free";
        user.planExpiry = null;
        await user.save();
      }

      // ✅ Free features
      const freeFeatures = ["topical"];

      if (!user.planId) {
        if (freeFeatures.includes(feature)) return next();

        return res.status(403).json({
          success: false,
          message: "Upgrade to Pro to access this feature"
        });
      }

      // ✅ Get plan
      const plan = await Plan.findById(user.planId);

      if (!plan) {
        return res.status(403).json({
          success: false,
          message: "Invalid plan"
        });
      }

      // ✅ Check feature
      if (plan.features.includes(feature)) return next();

      return res.status(403).json({
        success: false,
        message: "Feature not included in your plan"
      });

    } catch (err) {
      console.log(err);
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  };
};

module.exports = requireFeature;