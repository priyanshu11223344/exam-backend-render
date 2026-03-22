const Subject=require("../models/Subject");
const Board=require("../models/Board");

exports.createSubject=async(req,res)=>{
    try {
        const {boardId,name}=req.body;
        if(!boardId||!name){
            return res.status(400).json({message:"Board Id and Subject name are required"});
        }
        const boardExists=await Board.findById(boardId).select("_id");
        if(!boardExists){
            return res.status(404).json({message:"Board not found"});
        }
        const subject =await Subject.create({
            board:boardId,
            name,
        });
        res.status(201).json({
            success:true,
            data:subject,
        })
    } catch (error) {
        if(error.code==11000){
            return res.status(400).json({
                message:"Subject already exists in this board"
            })
        }
    }
}
exports.getSubjectByBoard=async(req,res)=>{
    try {
        const {boardId}=req.params;
        const subjects=await Subject.find({board:boardId}).select("name numberOfPaper createdAt").lean();
        res.status(200).json({
            success:true,
            count:subjects.length,
            data:subjects,
        })
    } catch (err) {
        console.error(err);
    }
};
exports.getSubjectById=async(req,res)=>{
try {
    const subject=await Subject.findById(req.params.id).populate("board" ,"name").lean();
    if (!subject) {
        return res.status(404).json({
          message: "Subject not found",
        });
      }
  
      res.status(200).json({
        success: true,
        data: subject,
      });
} catch (error) {
    console.error(error);
}
};
exports.deleteSubject = async (req, res) => {
    try {
      const subject = await Subject.findByIdAndDelete(req.params.id);
  
      if (!subject) {
        return res.status(404).json({
          message: "Subject not found",
        });
      }
  
      res.status(200).json({
        success: true,
        message: "Subject deleted successfully",
      });
    } catch (error) {
      console.error(error);
    }
  };