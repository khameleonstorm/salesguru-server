const mongoose = require("mongoose");


// util schema
const utilSchema = new mongoose.Schema({
  coins: [
    {
      name: String,
      address: String,
      network: String,
      price: Number
    }
  ], 
  rate: Number,
});


// util model
const Util = mongoose.model("Util", utilSchema);


exports.Util = Util;