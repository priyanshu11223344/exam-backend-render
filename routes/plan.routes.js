// routes/planRoutes.js

const express = require("express");
const router = express.Router();

const {
  createPlan,
  getPlans,
  getPlanById,
  updatePlan,
  deletePlan
} = require("../controllers/plan.controller");

// 🔐 Later you can add admin middleware here

router.post("/", createPlan);        // Admin
router.get("/", getPlans);           // Public
router.get("/:id", getPlanById);     // Public
router.put("/:id", updatePlan);      // Admin
router.delete("/:id", deletePlan);   // Admin

module.exports = router;