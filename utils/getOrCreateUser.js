// utils/getOrCreateUser.js

const User = require("../models/User");
const { clerkClient } = require("@clerk/clerk-sdk-node");
const getOrCreateUser = async (req) => {
  const auth = req.auth(); // ✅ CALL FUNCTION
 
  // console.log("AUTH OBJECT:", auth);

  const clerkId = auth.userId;
  const clerkUser = await clerkClient.users.getUser(clerkId);
  if (!clerkId) {
    throw new Error("Unauthorized");
  }

  let user = await User.findOne({ clerkId });

  if (!user) {
    user = await User.create({
      clerkId,
      email: clerkUser.emailAddresses[0]?.emailAddress || "",
      name: auth.sessionClaims?.name || "User"
    });
  }
 
  return user;
};

module.exports = getOrCreateUser;