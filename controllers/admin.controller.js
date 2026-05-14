const XLSX = require("xlsx");
const mongoose = require("mongoose");

const {
  processPaperRow,
} = require("../services/paperUploadService");

/* =====================================
   EXCEL UPLOAD
===================================== */

exports.uploadExcel = async (req, res) => {
  const session = await mongoose.startSession();

  session.startTransaction();

  try {
    const workbook = XLSX.readFile(req.file.path);

    const sheet =
      workbook.Sheets[workbook.SheetNames[0]];

    const rows =
      XLSX.utils.sheet_to_json(sheet);

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of rows) {
      const result =
        await processPaperRow(row, session);

      if (result === "inserted") inserted++;

      else if (result === "updated") updated++;

      else skipped++;
    }

    await session.commitTransaction();

    session.endSession();

    res.json({
      inserted,
      updated,
      skipped,
    });
  } catch (err) {
    await session.abortTransaction();

    session.endSession();

    console.log("error is", err.message);

    res.status(500).json({
      error: err.message,
    });
  }
};

/* =====================================
   FORM UPLOAD
===================================== */

exports.uploadQuestionsByForm = async (
  req,
  res
) => {
  const session = await mongoose.startSession();

  session.startTransaction();

  try {
    const rows = req.body.questions;

    if (
      !rows ||
      !Array.isArray(rows) ||
      rows.length === 0
    ) {
      return res.status(400).json({
        error: "Questions array is required",
      });
    }

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of rows) {
      const result =
        await processPaperRow(row, session);

      if (result === "inserted") inserted++;

      else if (result === "updated") updated++;

      else skipped++;
    }

    await session.commitTransaction();

    session.endSession();

    res.json({
      success: true,
      inserted,
      updated,
      skipped,
    });
  } catch (err) {
    await session.abortTransaction();

    session.endSession();

    console.log("error is", err.message);

    res.status(500).json({
      error: err.message,
    });
  }
};