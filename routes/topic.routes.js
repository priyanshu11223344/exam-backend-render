const express=require("express");
const router=express.Router();
const {createTopic,getTopicsBySubject,getTopicById,deleteTopic}=require("../controllers/topic.controller");
const requireUser = require("../middleware/requireUser");
const requireAdminPermission = require("../middleware/requireAdminPermission");

router.post("/", requireUser(["admin", "staff"]), requireAdminPermission("content"), createTopic);
router.get("/subject/:subjectId",getTopicsBySubject);
router.get("/:id",getTopicById);
router.delete("/:id", requireUser(["admin", "staff"]), requireAdminPermission("content"), deleteTopic);
module.exports=router;
