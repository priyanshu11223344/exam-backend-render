// controllers/planController.js

const Plan = require("../models/Plan");


// ✅ CREATE PLAN (Admin)
exports.createPlan = async (req, res) => {
  try {
    const { name, features, durations } = req.body;

    if (!name || !features || !durations) {
      return res.status(400).json({
        error: "All fields are required"
      });
    }

    const existing = await Plan.findOne({ name });
    if (existing) {
      return res.status(400).json({
        error: "Plan already exists"
      });
    }

    const plan = await Plan.create({
      name,
      features,
      durations
    });

    res.status(201).json({
      success: true,
      plan
    });

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
};



// ✅ GET ALL ACTIVE PLANS (User)
exports.getPlans = async (req, res) => {
  try {
    const plans = await Plan.find({ isActive: true });

    res.json({
      success: true,
      plans
    });

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
};



// ✅ GET SINGLE PLAN
exports.getPlanById = async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);

    if (!plan) {
      return res.status(404).json({
        error: "Plan not found"
      });
    }

    res.json({
      success: true,
      plan
    });

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
};



// ✅ UPDATE PLAN (Admin)
exports.updatePlan = async (req, res) => {
    try {
      const updates = req.body;
  
      // ❗ 1. Reject empty body
      if (!updates || Object.keys(updates).length === 0) {
        return res.status(400).json({
          error: "No data provided for update"
        });
      }
  
      // ❗ 2. Allow only specific fields
      const allowedUpdates = ["name", "features", "durations", "isActive"];
  
      const isValid = Object.keys(updates).every(field =>
        allowedUpdates.includes(field)
      );
  
      if (!isValid) {
        return res.status(400).json({
          error: "Invalid fields in update"
        });
      }
  
      // ❗ 3. Perform update
      const plan = await Plan.findByIdAndUpdate(
        req.params.id,
        { $set: updates },
        {
          new: true,
          runValidators: true
        }
      );
  
      // ❗ 4. Check if plan exists
      if (!plan) {
        return res.status(404).json({
          error: "Plan not found"
        });
      }
  
      res.json({
        success: true,
        plan
      });
  
    } catch (err) {
      console.log("UPDATE ERROR:", err);
      res.status(500).json({
        error: err.message
      });
    }
  };



// ✅ DELETE / DISABLE PLAN (Admin)
exports.deletePlan = async (req, res) => {
  try {
    const plan = await Plan.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!plan) {
      return res.status(404).json({
        error: "Plan not found"
      });
    }

    res.json({
      success: true,
      message: "Plan disabled successfully"
    });

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
};