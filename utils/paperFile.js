const fs = require("fs/promises");
const path = require("path");

const PDF_HEADER = Buffer.from("%PDF-");
const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const startsWith = (buffer, signature) =>
  buffer.length >= signature.length && buffer.subarray(0, signature.length).equals(signature);

const detectPaper = (input, { repairEmbeddedPdf = false } = {}) => {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);

  if (startsWith(buffer, PDF_HEADER)) {
    return { buffer, mimeType: "application/pdf", extension: "pdf" };
  }
  if (startsWith(buffer, PNG_HEADER)) {
    return { buffer, mimeType: "image/png", extension: "png" };
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { buffer, mimeType: "image/jpeg", extension: "jpg" };
  }

  if (repairEmbeddedPdf) {
    const pdfOffset = buffer.indexOf(PDF_HEADER);
    if (pdfOffset > 0 && pdfOffset <= 4096) {
      return {
        buffer: buffer.subarray(pdfOffset),
        mimeType: "application/pdf",
        extension: "pdf",
        repaired: true,
      };
    }
  }

  throw new Error("The uploaded paper is not a valid PDF, PNG, or JPEG file.");
};

const validateUploadedPaper = async (file) => {
  if (!file?.path) throw new Error("Question paper file is missing.");
  const handle = await fs.open(file.path, "r");
  try {
    const header = Buffer.alloc(8);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    return detectPaper(header.subarray(0, bytesRead));
  } finally {
    await handle.close();
  }
};

const readStoredPaper = async (storedFile) => {
  if (!storedFile) throw new Error("Question paper is unavailable.");

  let buffer;
  if (storedFile.url) {
    const response = await fetch(storedFile.url, {
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error("Question paper storage could not be reached.");
    buffer = Buffer.from(await response.arrayBuffer());
  } else if (storedFile.path) {
    const uploadsRoot = path.resolve(__dirname, "..", "uploads");
    const relativePath = String(storedFile.path).replace(/^\/?uploads\//, "");
    const absolutePath = path.resolve(uploadsRoot, relativePath);
    if (!absolutePath.startsWith(`${uploadsRoot}${path.sep}`)) {
      throw new Error("Invalid question paper path.");
    }
    buffer = await fs.readFile(absolutePath);
  } else {
    throw new Error("Question paper storage location is missing.");
  }

  return detectPaper(buffer, { repairEmbeddedPdf: true });
};

module.exports = {
  detectPaper,
  readStoredPaper,
  validateUploadedPaper,
};
