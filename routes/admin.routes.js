// routes/admin.route.js

const express = require("express");
const router = express.Router();
const multer = require("multer");

const upload = multer({ dest: "uploads/" });

const { uploadExcel } = require("../controllers/admin.controller");

router.post("/upload-excel", upload.single("file"), uploadExcel);

module.exports = router;
