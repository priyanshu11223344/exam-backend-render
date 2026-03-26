const { v2: cloudinary } = require("cloudinary");
const Paper = require("../models/Paper");

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

const getDriveFileId = (url) => {
  if (!url) return null;
  if (url.includes("/d/")) return url.split("/d/")[1]?.split("/")[0];
  if (url.includes("id=")) return url.split("id=")[1]?.split("&")[0];
  return null;
};

const uploadToCloudinary = async (driveUrl) => {
  try {
    const fileId = getDriveFileId(driveUrl);
    if (!fileId) return null;

    let downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    console.log("⬇️ Downloading:", downloadUrl);

    let response = await fetch(downloadUrl);

    if (response.headers.get("content-type")?.includes("text/html")) {
      const text = await response.text();
      const confirmToken = text.match(/confirm=([0-9A-Za-z_]+)&/);

      if (confirmToken) {
        downloadUrl = `https://drive.google.com/uc?export=download&confirm=${confirmToken[1]}&id=${fileId}`;
        response = await fetch(downloadUrl);
      } else {
        console.log("❌ Drive confirm failed");
        return null;
      }
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    console.log("⬆️ Uploading to Cloudinary...");

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "exam-app",
          public_id: fileId,
          overwrite: true,
        },
        (err, res) => {
          if (err) return reject(err);
          resolve(res);
        }
      );

      stream.end(buffer);
    });

    console.log("✅ Uploaded:", result.secure_url);

    return result.secure_url;
  } catch (err) {
    console.log("❌ Upload failed:", err.message);
    return null;
  }
};

const processPendingUploads = async () => {
  try {
    console.log("\n🔄 Running background upload...");

    const papers = await Paper.find({
      $or: [
        { questionPaper: { $elemMatch: { status: "pending" } } },
        { markScheme: { $elemMatch: { status: "pending" } } },
      ],
    });

    console.log(`📦 Found ${papers.length} pending papers`);

    for (const paper of papers) {
      let updated = false;

      for (let file of paper.questionPaper) {
        if (file.status !== "pending") continue;

        console.log("📄 Processing QP:", file.originalUrl);

        const newUrl = await uploadToCloudinary(file.originalUrl);

        if (newUrl) {
          file.cloudinaryUrl = newUrl;
          file.status = "done";
        } else {
          file.status = "failed";
        }

        updated = true;
      }

      for (let file of paper.markScheme) {
        if (file.status !== "pending") continue;

        console.log("📄 Processing MS:", file.originalUrl);

        const newUrl = await uploadToCloudinary(file.originalUrl);

        if (newUrl) {
          file.cloudinaryUrl = newUrl;
          file.status = "done";
        } else {
          file.status = "failed";
        }

        updated = true;
      }

      if (updated) {
        await paper.save();
        console.log("✅ Updated paper:", paper._id);
      }
    }
  } catch (err) {
    console.error("❌ Background job error:", err.message);
  }
};

const startUploader = () => {
  setInterval(processPendingUploads, 10000);
};

module.exports = startUploader;