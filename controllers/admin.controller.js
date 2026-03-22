const XLSX = require("xlsx");
const mongoose = require("mongoose");

const Board = require("../models/Board");
const Subject = require("../models/Subject");
const Topic = require("../models/Topic");
const Paper = require("../models/Paper");

/* ===============================
   Helper Functions
================================= */

// Clean URL
const cleanUrl = (url) => {
  if (!url) return null;
  return url.toString().replace(/^"|"$/g, "").trim();
};

// Detect file type
const detectFileType = (url) => {
  if (!url) return "link";

  const lower = url.toLowerCase();

  if (lower.endsWith(".pdf")) return "pdf";

  if (
    lower.includes(".png") ||
    lower.includes(".jpg") ||
    lower.includes(".jpeg") ||
    lower.includes(".webp") ||
    lower.includes("lh3.googleusercontent.com") ||
    lower.includes("imgur.com")
  ) {
    return "image";
  }

  return "link";
};

// 🔥 FINAL BUILD FUNCTION
const buildFileArray = (field) => {
  if (!field) return [];

  return field
    .toString()
    .split("|")
    .map((link) => link.trim())
    .filter((link) => link.length > 0)
    .map((link) => {
      const cleaned = cleanUrl(link);

      return {
        fileType: detectFileType(cleaned),
        url: cleaned,
        status: "pending", // 🔥 ALWAYS pending
      };
    });
};

/* ===============================
   MAIN CONTROLLER
================================= */

exports.uploadExcel = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    let inserted = 0;
    let skipped = 0;

    for (const row of rows) {
      const {
        board,
        subject,
        topic,
        year,
        season,
        paperNumber,
        variant,
        questionPaper,
        markScheme,
        explanation,
        specialComment,
      } = row;

      if (!board || !subject || !topic) continue;

      /* ===== BOARD ===== */
      let boardDoc = await Board.findOne({ name: board }).session(session);

      if (!boardDoc) {
        boardDoc = (await Board.create([{ name: board }], { session }))[0];
      }

      /* ===== SUBJECT ===== */
      let subjectDoc = await Subject.findOne({
        name: subject,
        board: boardDoc._id,
      }).session(session);

      if (!subjectDoc) {
        subjectDoc = (
          await Subject.create(
            [{ name: subject, board: boardDoc._id }],
            { session }
          )
        )[0];
      }

      /* ===== TOPIC ===== */
      let topicDoc = await Topic.findOne({
        name: topic,
        subject: subjectDoc._id,
      }).session(session);

      if (!topicDoc) {
        topicDoc = (
          await Topic.create(
            [{ name: topic, subject: subjectDoc._id }],
            { session }
          )
        )[0];
      }

      /* ===== DUPLICATE CHECK ===== */
      const existingPaper = await Paper.findOne({
        topic: topicDoc._id,
        year,
        season,
        paperNumber,
        variant,
      }).session(session);

      if (existingPaper) {
        skipped++;
        continue;
      }

      /* ===== CREATE PAPER ===== */
      await Paper.create(
        [
          {
            topic: topicDoc._id,
            topicName: topicDoc.name,
            year,
            season,
            paperNumber,
            variant,

            questionPaper: buildFileArray(questionPaper),
            markScheme: buildFileArray(markScheme),

            explanation: explanation
              ? {
                  fileType: detectFileType(explanation),
                  url: cleanUrl(explanation),
                }
              : undefined,

            specialComment: specialComment
              ? {
                  fileType: detectFileType(specialComment),
                  url: cleanUrl(specialComment),
                }
              : undefined,
          },
        ],
        { session }
      );

      inserted++;
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      message: "Uploaded instantly 🚀",
      inserted,
      skipped,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error(error);

    return res.status(500).json({
      message: "Upload failed",
      error: error.message,
    });
  }
};