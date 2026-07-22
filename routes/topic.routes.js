const express=require("express");
const router=express.Router();
const {createTopic,getTopicsBySubject,getTopicById,deleteTopic}=require("../controllers/topic.controller");
const requireUser = require("../middleware/requireUser");

router.post("/",requireUser(["admin"]),createTopic);
router.get("/subject/:subjectId",getTopicsBySubject);
router.get("/:id",getTopicById);
router.delete("/:id",requireUser(["admin"]),deleteTopic);
module.exports=router;
