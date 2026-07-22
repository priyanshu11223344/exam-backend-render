const express=require("express");
const router=express.Router();
const {createBoard,getBoards,getBoardById,deleteBoard}=require("../controllers/board.controller")
const requireUser = require("../middleware/requireUser");
const requireAdminPermission = require("../middleware/requireAdminPermission");

router.post("/", requireUser(["admin", "staff"]), requireAdminPermission("content"), createBoard);
router.get("/",getBoards);
router.get("/:id", getBoardById);
router.delete("/:id", requireUser(["admin", "staff"]), requireAdminPermission("content"), deleteBoard);

module.exports=router;
