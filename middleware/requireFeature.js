// middleware/requireFeature.js

const getUserContext = require("../utils/getUserContext");

const requireFeature = (feature) => {
  return async (req, res, next) => {
    try {
      const { features, isAdmin } = await getUserContext(req);

      // ✅ ADMIN BYPASS
      console.log({ isAdmin, features });
      if (isAdmin) return next();

      // ✅ normal users
      if (features.includes(feature)) return next();

      return res.status(403).json({
        success: false,
        message: "Upgrade to Pro to access this feature",
      });

    } catch (err) {
      console.error(err);
      res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  };
};

module.exports = requireFeature;