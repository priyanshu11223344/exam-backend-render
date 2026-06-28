// utils/getOrCreateUser.js

const User = require("../models/User");
const { clerkClient } = require("@clerk/clerk-sdk-node");

const getLocalIdentity = (req) => {
  const origin = req.get("origin") || "";
  const isLocalRequest =
    origin === "http://localhost:5173" ||
    origin === "http://127.0.0.1:5173";

  if (process.env.CLERK_SECRET_KEY || !isLocalRequest) {
    return null;
  }

  const clerkId = req.get("x-local-clerk-id");
  const email = req.get("x-local-user-email");
  const name = req.get("x-local-user-name") || "Student";
  const role = ["admin", "teacher", "user"].includes(req.get("x-local-user-role"))
    ? req.get("x-local-user-role")
    : "user";

  if (!clerkId || !email) {
    throw new Error("Local user identity is missing");
  }

  return { clerkId, email, name, role };
};

const getOrCreateUser = async (req) => {
  const localIdentity = getLocalIdentity(req);

  if (localIdentity) {
    let user = await User.findOne({
      $or: [
        { clerkId: localIdentity.clerkId },
        { email: localIdentity.email },
      ],
    });

    if (!user) {
      user = await User.create(localIdentity);
    } else if (!user.clerkId) {
      user.clerkId = localIdentity.clerkId;
      await user.save();
    }

    if (localIdentity.role !== "user") user.role = localIdentity.role;
    user.role = user.role || "user";
    return user;
  }

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
      role: role || "user",
    });
  }

  user.role = role || user.role || "user";

  return user;
};

module.exports = getOrCreateUser;
