const express = require("express");
const path = require("path");
const ConnectDb = require("./config/db");
const cors = require("cors");
const { clerkMiddleware } = require("@clerk/express");
const helmet = require("helmet");
const compression = require("compression");
const { rateLimit } = require("express-rate-limit");

const app = express();

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(compression());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use("/uploads", express.static(path.join(__dirname, "uploads"), { maxAge: "1d", immutable: false }));

if (process.env.CLERK_SECRET_KEY) {
  app.use(clerkMiddleware());
} else {
  console.warn("CLERK_SECRET_KEY is missing; Clerk middleware is disabled.");
}

app.use(
  cors({
    origin(origin, callback) {
      const allowedOrigins = new Set([
        process.env.CLIENT_ORIGIN,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://exam-frontend-iota.vercel.app",
      ].filter(Boolean));

      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true,
  })
);

app.use("/api", rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_PER_MINUTE) || 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
}));

app.get("/health", (_req, res) => res.json({ status: "ok", uptime: Math.round(process.uptime()) }));

const boardRoutes = require("./routes/board.routes");
const subjectRoutes = require("./routes/subject.routes");
const topicRoutes = require("./routes/topic.routes");
const paperRoutes = require("./routes/paper.routes");
const adminRoutes = require("./routes/admin.routes");
const paperNameRoutes = require("./routes/paperNameRoutes");
const quizRoutes = require("./routes/quiz.routes");
const planRoutes = require("./routes/plan.routes");
const featureRoutes = require("./routes/feature.routes");
const userRoutes = require("./routes/user.routes");
const paymentRoutes = require("./routes/payment.routes");
const examRoutes = require("./routes/exam.routes");
const teacherRoutes = require("./routes/teacher.routes");
const classroomRoutes = require("./routes/classroom.routes");
const startUploader = require("./utils/backgroundUploader");

app.use("/api/boards", boardRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/topics", topicRoutes);
app.use("/api/papers", paperRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/paperName", paperNameRoutes);
app.use("/api/quiz", quizRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/features", featureRoutes);
app.use("/api/user", userRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/classroom", classroomRoutes);

app.use((req, res) => res.status(404).json({ success: false, error: `Route not found: ${req.method} ${req.path}` }));
app.use((err, _req, res, _next) => {
  console.error("Unhandled request error", err);
  const status = err.name === "MulterError" || err.message?.includes("Only PDF") ? 400 : 500;
  res.status(status).json({ success: false, error: status === 500 ? "Internal server error" : err.message });
});

ConnectDb().then(() => {
  console.log("✅ DB Connected");

  if (process.env.ENABLE_BACKGROUND_UPLOADER !== "false") startUploader();

  const port = process.env.PORT || 5000;
  const server = app.listen(port, () => {
    console.log(`🚀 Server running at port ${port}`);
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 35_000;

  const shutdown = (signal) => {
    console.log(`${signal} received; closing server.`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
});
