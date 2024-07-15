const mongoose = require("mongoose");


// transaction schema
const transactionSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    minLength: 5,
    maxLength: 20
  },
  user: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
    },
    email: {
      type: String,
    },
    name: {
      type: String,
    },
  },
  status: {
    type: String,
    default: "pending",
    minLength: 4,
    maxLength: 20
  },
  amount: {
    type: Number,
    required: true,
    minLength: 10,
    maxLength: 20000000
  },
  date: {
    type: Date,
    default: Date.now,
  },
  
  walletData: {
    address: {
      type: String,
      default: '',
    },
    network: {
      type: String,
      default: '',
    },
    coinName: {
      type: String,
      default: '',
    },
    convertedAmount: {
      type: Number,
      default: '',
    },
  },

  bankData: {
    accountName: {
      type: String,
      default: '',
    },
    accountNumber: {
      type: String,
      default: '',
    },
    bankName: {
      type: String,
      default: '',
    },
  },

  productData: {
    name: {
      type: String,
      default: '',
    },
    buyPrice: {
      type: Number,
      default: 0,
    },
    sellPrice: {
      type: Number,
      default: 0,
    },
    quantity: {
      type: Number,
      default: 0,
    },
  },
});

const Transaction = mongoose.model("Transaction", transactionSchema);

exports.Transaction = Transaction;


