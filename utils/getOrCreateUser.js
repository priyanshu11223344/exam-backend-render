// utils/getOrCreateUser.js

const User = require("../models/User");

const getOrCreateUser = async (req) => {
  const auth = req.auth(); // ✅ CALL FUNCTION

  // console.log("AUTH OBJECT:", auth);

  const clerkId = auth.userId;

  if (!clerkId) {
    throw new Error("Unauthorized");
  }

  let user = await User.findOne({ clerkId });

  if (!user) {
    user = await User.create({
      clerkId,
      email: auth.sessionClaims?.email || "",
      name: auth.sessionClaims?.name || "User"
    });
  }

  return user;
};

module.exports = getOrCreateUser;