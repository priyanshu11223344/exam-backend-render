const express=require("express");
const router=express.Router();
const {createBoard,getBoards,getBoardById,deleteBoard}=require("../controllers/board.controller")
const requireUser = require("../middleware/requireUser");

router.post("/",requireUser(["admin"]),createBoard);
router.get("/",getBoards);
router.get("/:id", getBoardById);
router.delete("/:id", requireUser(["admin"]), deleteBoard);

module.exports=router;
