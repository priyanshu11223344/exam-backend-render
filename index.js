const express = require("express");
const path = require("path");
const ConnectDb = require("./config/db");
const cors = require("cors");
const { clerkMiddleware } = require("@clerk/express");

const app = express();

app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

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

ConnectDb().then(() => {
  console.log("✅ DB Connected");

  startUploader();

  const port = process.env.PORT || 5000;
  app.listen(port, () => {
    console.log(`🚀 Server running at port ${port}`);
  });
});
