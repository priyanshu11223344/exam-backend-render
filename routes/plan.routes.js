// routes/planRoutes.js

const express = require("express");
const router = express.Router();
const requireUser = require("../middleware/requireUser");
const requireAdminPermission = require("../middleware/requireAdminPermission");

const {
  createPlan,
  getPlans,
  getPlanById,
  updatePlan,
  deletePlan
} = require("../controllers/plan.controller");

// 🔐 Later you can add admin middleware here

router.post("/", requireUser(["admin", "staff"]), requireAdminPermission("plans"), createPlan);
router.get("/", getPlans);           // Public
router.get("/:id", getPlanById);     // Public
router.put("/:id", requireUser(["admin", "staff"]), requireAdminPermission("plans"), updatePlan);
router.delete("/:id", requireUser(["admin", "staff"]), requireAdminPermission("plans"), deletePlan);

module.exports = router;
