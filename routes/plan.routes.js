// routes/planRoutes.js

const express = require("express");
const router = express.Router();
const requireUser = require("../middleware/requireUser");

const {
  createPlan,
  getPlans,
  getPlanById,
  updatePlan,
  deletePlan
} = require("../controllers/plan.controller");

// 🔐 Later you can add admin middleware here

router.post("/", requireUser(["admin"]), createPlan);        // Admin
router.get("/", getPlans);           // Public
router.get("/:id", getPlanById);     // Public
router.put("/:id", requireUser(["admin"]), updatePlan);      // Admin
router.delete("/:id", requireUser(["admin"]), deletePlan);   // Admin

module.exports = router;
