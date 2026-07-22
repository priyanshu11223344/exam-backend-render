const requireAdminPermission = (...requiredPermissions) => (req, res, next) => {
  const user = req.currentUser;

  if (user?.role === "admin") return next();

  const permissions = new Set(user?.adminPermissions || []);
  const permitted = user?.role === "staff" && requiredPermissions.some((permission) => permissions.has(permission));

  if (!permitted) {
    return res.status(403).json({
      success: false,
      error: "Your staff account does not have permission for this action.",
    });
  }

  return next();
};

module.exports = requireAdminPermission;
