const express=require("express");
const router=express.Router();
const {getQuizQuestions}=require("../controllers/quiz.controller");
router.get("/",getQuizQuestions);
module.exports=router;