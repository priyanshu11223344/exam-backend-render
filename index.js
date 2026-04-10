const express=require("express");
const ConnectDb=require("./config/db")
const app=express();
const cors=require("cors");
const {clerkMiddleware}=require("@clerk/express");
app.use(express.json());
app.use(clerkMiddleware());
app.use(
    cors({
       origin: "https://exam-frontend-iota.vercel.app",
      //origin: "http://localhost:5173",
      credentials: true,
    })
  );
const boardRoutes=require("./routes/board.routes")
const subjectRoutes=require("./routes/subject.routes")
const topicRoutes=require("./routes/topic.routes");
const paperRoutes=require("./routes/paper.routes")
const adminUpload=require("./routes/admin.routes");
app.use("/api/boards",boardRoutes);
app.use("/api/subjects",subjectRoutes);
app.use("/api/topics",topicRoutes);
app.use("/api/papers",paperRoutes);
app.use("/api/admin",adminUpload)
const startUploader = require("./utils/backgroundUploader");
const paperNameRoutes = require("./routes/paperNameRoutes");
const quizRoutes=require("./routes/quiz.routes");
const planRoutes=require("./routes/plan.routes");
const featureRoutes=require("./routes/feature.routes");
const userRoutes=require("./routes/user.routes")
const paymentRoutes=require("./routes/payment.routes")
// server.js / app.js



app.use("/api/paperName", paperNameRoutes);
app.use("/api/quiz",quizRoutes);
app.use("/api/plans",planRoutes);
app.use("/api/features",featureRoutes)
app.use("/api/user",userRoutes)
app.use("/api/payment",paymentRoutes)
ConnectDb().then(() => {
  console.log("✅ DB Connected");

  startUploader(); // ✅ start AFTER DB

  app.listen(5000, () => {
    console.log("🚀 Server running at port 5000");
  });
});