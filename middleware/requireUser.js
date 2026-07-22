const getOrCreateUser = require("../utils/getOrCreateUser");

const requireUser = (roles = []) => async (req, res, next) => {
  try {
    const user = await getOrCreateUser(req);
    if (roles.length && !roles.includes(user.role)) {
      return res.status(403).json({ success: false, error: "You do not have permission for this action." });
    }
    const requestedEmail = String(req.body?.teacherEmail || req.query?.teacherEmail || req.body?.userEmail || req.query?.userEmail || "").trim().toLowerCase();
    if (requestedEmail && user.role !== "admin" && requestedEmail !== String(user.email || "").toLowerCase()) {
      return res.status(403).json({ success: false, error: "Identity does not match the signed-in user." });
    }
    req.currentUser = user;
    next();
  } catch (_error) {
    return res.status(401).json({ success: false, error: "Authentication required." });
  }
};

module.exports = requireUser;
