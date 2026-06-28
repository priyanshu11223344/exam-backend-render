const mongoose=require('mongoose');
require('dotenv').config();
const URI=process.env.MONGO_URI
const connectDB= async()=>{
    try{
        await mongoose.connect(URI, { serverSelectionTimeoutMS: 10000 })
        console.log("Connected to DB")
    }
    catch(error){
            console.error(error);
            throw error;
    }
}

module.exports=connectDB
