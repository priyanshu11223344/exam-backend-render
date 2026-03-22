const Board=require("../models/Board");
exports.createBoard=async(req,res)=>{
 try {
    const {name}=req.body;
    if(!name){
        return res.status(400).json({message:"Board name is required"});
    }
        const existingBoard=await Board.findOne({name});
        if(existingBoard){
            return res.status(400).json({message:"Board already exists"});
        }
        const board=await Board.create({
            name
        });
        res.status(201).json({
            success:true,
            data:board,
        })
    
 } catch (error) {
    console.error(error.message);
 }
}
exports.getBoards=async(req,res)=>{
    try {
        const boards=await Board.find().lean();
        res.status(200).json({
            success:true,
            count:boards.length,
            data:boards,
        })
    } catch (error) {
        console.error(error.message);
    }
};
exports.getBoardById = async (req, res) => {
    try {
      const board = await Board.findById(req.params.id).lean();
  
      if (!board) {
        return res.status(404).json({ message: "Board not found" });
      }
  
      res.status(200).json({
        success: true,
        data: board,
      });
    } catch (error) {
      console.error(error)
    }
  };
  exports.deleteBoard = async (req, res) => {
    try {
      const board = await Board.findByIdAndDelete(req.params.id);
  
      if (!board) {
        return res.status(404).json({ message: "Board not found" });
      }
  
      res.status(200).json({
        success: true,
        message: "Board deleted successfully",
      });
    } catch (error) {
     console.error(error);
    }
  };