const express = require("express");
const { Transaction } = require("../models/transaction");
const { User } = require("../models/user");
const mongoose = require("mongoose");
const { productAlertMail } = require("../utils/mailer");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const products = await Transaction.find({ type: "product" }).sort({
      date: "desc",
    });
    res.send(products);
  } catch (error) {
    console.error(error);
    return res.status(500).send({ message: "Something Went Wrong..." });
  }
});

// New route to get active products for a particular user
router.get("/user/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const activeProducts = await Transaction.find({
      type: "product",
      status: "pending",
      "user.id": userId,
    }).sort({ date: "asc" });
    res.send(activeProducts);
  } catch (error) {
    console.error(error);
    return res.status(500).send({ message: "Something Went Wrong..." });
  }
});

// Creating a product
router.post("/user/:userId", async (req, res) => {
  const { name, buyPrice, sellPrice, quantity } = req.body;
  const userId = req.params.userId;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).send({ message: "Something went wrong" });
    }

    // Deduct the buyPrice from the user's balance
    user.withdraw(buyPrice);
    await user.save({ session });

    // Create a new product transaction
    const product = new Transaction({
      user: { id: userId, name: user.fullName, email: user.email },
      productData: { name, buyPrice, sellPrice, quantity },
      type: "product",
      amount: buyPrice,
    });

    await product.save({ session });

    // Send product email
    await productAlertMail(name, user.email, buyPrice, sellPrice, quantity);

    await session.commitTransaction();
    session.endSession();

    res.status(200).send({ message: "Product purchased successfully" });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error(error);
    for (const i in error.errors) {
      res.status(500).send({ message: error.errors[i].message });
    }
  }
});

// Updating product and user interest
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const transaction = await Transaction.findOne({
      _id: id,
      status: "pending",
    }).session(session);

    if (!transaction) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).send({ message: "Transaction not found" });
    }

    const currentDate = new Date();
    const transactionDate = new Date(transaction.date);
    const diffTime = Math.abs(currentDate - transactionDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 14) {
      const user = await User.findById(transaction.user.id).session(session);
      if (user) {
        const calculatedInterest = transaction.productData.sellPrice;
        user.interest += calculatedInterest;
        await user.save({ session });
      }

      transaction.status = "success";
      await transaction.save({ session });
    } else {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).send({ message: "Product Is Less Than 14 days" });
    }

    await session.commitTransaction();
    session.endSession();
    res.send({ message: "Product and user interest successfully updated" });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});


// Updating products and user interests
router.put("/multiple", async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const pendingTransactions = await Transaction.find({
      status: "pending",
      type: "product",
    }).session(session);
    const currentDate = new Date();

    for (const transaction of pendingTransactions) {
      const transactionDate = new Date(transaction.date);
      const diffTime = Math.abs(currentDate - transactionDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > 14) {
        const user = await User.findById(transaction.user.id).session(session);
        if (user) {
          const calculatedInterest = transaction.productData.sellPrice;
          user.interest += calculatedInterest;
          await user.save({ session });
        }

        transaction.status = "success";
        await transaction.save({ session });
      }
    }

    await session.commitTransaction();
    session.endSession();
    res.send({ message: "Products and user interests successfully updated" });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

// Deleting a product
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const product = await Transaction.findByIdAndRemove(id);
    if (!product) return res.status(404).send({ message: "Product not found" });

    res.send(product);
  } catch (error) {
    for (i in error.errors)
      res.status(500).send({ message: error.errors[i].message });
  }
});

module.exports = router;
