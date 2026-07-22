const express=require("express");
const router=express.Router();
const {createSubject,getSubjectByBoard,getSubjectById,deleteSubject}=require("../controllers/subject.controller");
const requireUser = require("../middleware/requireUser");
router.post("/",requireUser(["admin"]),createSubject);
router.get("/board/:boardId",getSubjectByBoard);
router.get("/:id",getSubjectById);
router.delete("/:id",requireUser(["admin"]),deleteSubject);
module.exports=router;
