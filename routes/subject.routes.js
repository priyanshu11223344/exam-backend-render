const express=require("express");
const router=express.Router();
const {createSubject,getSubjectByBoard,getSubjectById,deleteSubject}=require("../controllers/subject.controller");
router.post("/",createSubject);
router.get("/board/:boardId",getSubjectByBoard);
router.get("/:id",getSubjectById);
router.delete("/:id",deleteSubject);
module.exports=router;