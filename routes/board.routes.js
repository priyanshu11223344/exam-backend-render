const express=require("express");
const router=express.Router();
const {createBoard,getBoards,getBoardById,deleteBoard}=require("../controllers/board.controller")

router.post("/",createBoard);
router.get("/",getBoards);
router.get("/:id", getBoardById);
router.delete("/:id", deleteBoard);

module.exports=router;