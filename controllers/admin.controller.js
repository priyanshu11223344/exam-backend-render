const XLSX = require("xlsx");
const mongoose = require("mongoose");

const Board = require("../models/Board");
const Subject = require("../models/Subject");
const Topic = require("../models/Topic");
const Paper = require("../models/Paper");

/* ===============================
   HELPERS
================================= */

const cleanUrl = (url) => {
  if (!url) return "";
  return url.toString().replace(/^"|"$/g, "").trim();
};

const detectFileType = (url) => {
  if (!url) return "link";

  const lower = url.toLowerCase();

  if (lower.endsWith(".pdf")) return "pdf";

  if (
    lower.includes(".png") ||
    lower.includes(".jpg") ||
    lower.includes(".jpeg") ||
    lower.includes(".webp")
  ) {
    return "image";
  }

  return "link";
};

const normalizeLinks = (field) => {
  if (!field) return [];
  return field
    .toString()
    .split("|")
    .map((l) => cleanUrl(l))
    .filter(Boolean);
};

const isSameArray = (arr1, arr2) => {
  if (arr1.length !== arr2.length) return false;
  return arr1.every((v, i) => v === arr2[i]);
};

// ✅ MERGE USING originalUrl
const mergeFiles = (oldFiles, newLinks) => {
  return newLinks.map((link) => {
    const existing = oldFiles.find(
      (f) => f.originalUrl === link
    );

    if (existing) return existing;

    return {
      fileType: detectFileType(link),
      originalUrl: link,
      cloudinaryUrl: null,
      status: "pending",
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
    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    let inserted = 0;
    let updated = 0;
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
        questionNumber,
        questionPaper,
        markScheme,
        explanation,
        specialComment,
      } = row;

      if (!board || !subject || !topic || !questionNumber) continue;

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

      const qpLinks = normalizeLinks(questionPaper);
      const msLinks = normalizeLinks(markScheme);

      const existing = await Paper.findOne({
        topic: topicDoc._id,
        year,
        season,
        paperNumber,
        variant,
        questionNumber,
      }).session(session);

      if (existing) {
        const existingQP = (existing.questionPaper || []).map(
          (f) => f.originalUrl
        );

        const existingMS = (existing.markScheme || []).map(
          (f) => f.originalUrl
        );

        const sameQP = isSameArray(existingQP, qpLinks);
        const sameMS = isSameArray(existingMS, msLinks);

        const sameExplanation =
          cleanUrl(existing.explanation?.originalUrl) === cleanUrl(explanation);

        const sameComment =
          cleanUrl(existing.specialComment?.originalUrl) === cleanUrl(specialComment);

        if (sameQP && sameMS && sameExplanation && sameComment) {
          skipped++;
          continue;
        }

        if (!sameQP) {
          existing.questionPaper = mergeFiles(
            existing.questionPaper || [],
            qpLinks
          );
        }

        if (!sameMS) {
          existing.markScheme = mergeFiles(
            existing.markScheme || [],
            msLinks
          );
        }

        if (!sameExplanation) {
          existing.explanation = explanation
            ? {
                fileType: detectFileType(explanation),
                originalUrl: cleanUrl(explanation),
                cloudinaryUrl: null,
                status: "pending",
              }
            : undefined;
        }

        if (!sameComment) {
          existing.specialComment = specialComment
            ? {
                fileType: detectFileType(specialComment),
                originalUrl: cleanUrl(specialComment),
                cloudinaryUrl: null,
                status: "pending",
              }
            : undefined;
        }

        if (!existing.isModified()) {
          skipped++;
          continue;
        }

        await existing.save({ session });
        updated++;
      } else {
        await Paper.create(
          [
            {
              topic: topicDoc._id,
              topicName: topicDoc.name,
              year,
              season,
              paperNumber,
              variant,
              questionNumber,

              questionPaper: mergeFiles([], qpLinks),
              markScheme: mergeFiles([], msLinks),

              explanation: explanation
                ? {
                    fileType: detectFileType(explanation),
                    originalUrl: cleanUrl(explanation),
                    cloudinaryUrl: null,
                    status: "pending",
                  }
                : undefined,

              specialComment: specialComment
                ? {
                    fileType: detectFileType(specialComment),
                    originalUrl: cleanUrl(specialComment),
                    cloudinaryUrl: null,
                    status: "pending",
                  }
                : undefined,
            },
          ],
          { session }
        );

        inserted++;
      }
    }

    await session.commitTransaction();
    session.endSession();

    res.json({ inserted, updated, skipped });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ error: err.message });
  }
};