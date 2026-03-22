const express=require("express");
const ConnectDb=require("./config/db")
const app=express();
const cors=require("cors")
app.use(express.json());
app.use(
    cors({
      origin: "https://exam-frontend-iota.vercel.app",
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


ConnectDb().then(() => {
  console.log("✅ DB Connected");

  startUploader(); // ✅ start AFTER DB

  app.listen(5000, () => {
    console.log("🚀 Server running at port 5000");
  });
});