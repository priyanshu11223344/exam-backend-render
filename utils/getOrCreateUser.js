// utils/getOrCreateUser.js

const User = require("../models/User");
const { clerkClient } = require("@clerk/clerk-sdk-node");

const getOrCreateUser = async (req) => {
  const auth = req.auth();

  const clerkId = auth.userId;
  if (!clerkId) {
    throw new Error("Unauthorized");
  }

  // ✅ FAST: get role from token first (no API call)
  let role = auth.sessionClaims?.public_metadata?.role;

  let clerkUser;

  // 🔥 fallback only if role not present
  if (!role) {
    clerkUser = await clerkClient.users.getUser(clerkId);
    role = clerkUser.publicMetadata?.role || "user";
  }

  let user = await User.findOne({ clerkId });

  if (!user) {
    // ensure we have clerkUser if needed
    if (!clerkUser) {
      clerkUser = await clerkClient.users.getUser(clerkId);
    }

    user = await User.create({
      clerkId,
      email: clerkUser.emailAddresses[0]?.emailAddress || "",
      name: auth.sessionClaims?.name || "User",
    });
  }

  // ✅ attach role (NOT saving in DB)
  user.role = role || "user";

  return user;
};

module.exports = getOrCreateUser;