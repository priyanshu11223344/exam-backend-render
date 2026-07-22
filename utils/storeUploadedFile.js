const fs = require("fs/promises");
const cloudinary = require("../config/cloudinary");

const cloudinaryConfigured = () => Boolean(process.env.CLOUD_NAME && process.env.API_KEY && process.env.API_SECRET);

module.exports = async (file, folder = "aurethia/uploads") => {
  if (!file) return undefined;
  if (!cloudinaryConfigured()) {
    if (process.env.NODE_ENV === "production") {
      await fs.unlink(file.path).catch(() => {});
      throw new Error("Cloudinary is required for production file uploads.");
    }
    return { originalName: file.originalname, filename: file.filename, path: `/uploads/${file.filename}`, mimeType: file.mimetype, size: file.size };
  }
  try {
    const uploaded = await cloudinary.uploader.upload(file.path, { resource_type: "auto", folder, use_filename: true, unique_filename: true });
    return { originalName: file.originalname, filename: file.filename, url: uploaded.secure_url, publicId: uploaded.public_id, mimeType: file.mimetype, size: file.size };
  } finally {
    await fs.unlink(file.path).catch(() => {});
  }
};
