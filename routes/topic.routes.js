const express=require("express");
const router=express.Router();
const {createTopic,getTopicsBySubject,getTopicById,deleteTopic}=require("../controllers/topic.controller");

router.post("/",createTopic);
router.get("/subject/:subjectId",getTopicsBySubject);
router.get("/:id",getTopicById);
router.delete("/:id",deleteTopic);
module.exports=router;