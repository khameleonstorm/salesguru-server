const express = require('express')
const mongoose = require('mongoose');
const { Transaction } = require("../models/transaction")
const { User } = require("../models/user")
const { depositMail } = require("../utils/mailer")
const Flutterwave = require('flutterwave-node-v3');
const flw = new Flutterwave(process.env.FLTW_PUBLIC_KEY, process.env.FLTW_SECRET_KEY);

const router  = express.Router()


// getting all deposits
router.get('/', async(req, res) => {
  try {
    const deposits = await Transaction.find({ type: "deposit" })
    res.send(deposits)
  } catch(e){ for(i in e.errors) res.status(500).send({message: e.errors[i].message}) }
})



// get all deposits by user
router.get('/user/:email', async(req, res) => {
  const { email } = req.params

  try {
    const deposits = await Transaction.find({ "user.email": email });
    if (!deposits || deposits.length === 0) return res.status(400).send({message: "Deposits not found..."})
    res.send(deposits);
  }
  catch(e){ for(i in e.errors) res.status(500).send({message: e.errors[i].message}) }
})




router.post('/', async (req, res) => {
  const { id, amount, name, cardNumber, cvv, expiryMonth, expiryYear, rate } = req.body;
  const amountInUsd = amount/rate
  const user = await User.findById(id);
  if (!user) return res.status(400).send({ message: 'Something went wrong' });


  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const payload = {
      "card_number": cardNumber,
      "cvv": cvv,
      "expiry_month": expiryMonth,
      "expiry_year": expiryYear,
      "currency": "NGN",
      "amount": amount,
      "fullname": name,
      "email": user.email,
      "phone_number": user.phone,
      "enckey": process.env.FLTW_ENC_KEY,
      "tx_ref": `tx-${Date.now()}`,
      "redirect_url": "https://www.savest-ltd.com",
    };

    const response = await flw.Charge.card(payload);

    // Handle the response
    if (response.status !== 'success') {
      throw new Error(response.message);
    }

    // let finalResponse;
    // if (response.meta.authorization.mode === 'pin') {
    //   const pinPayload = {
    //     ...payload,
    //     authorization: {
    //       mode: 'pin',
    //       fields: ['pin'],
    //       pin: '1234'
    //     }
    //   };

    //   const reCallCharge = await flw.Charge.card(pinPayload);

    //   finalResponse = await flw.Charge.validate({
    //     otp: '12345',
    //     flw_ref: reCallCharge.data.flw_ref,
    //   });
    // } else if (response.meta.authorization.mode === 'redirect') {
    //   await session.commitTransaction();
    //   session.endSession();
    //   return res.send({ message: 'Please complete the payment on the redirected page', redirect_url: response.meta.authorization.redirect });
    // } else {
    //   finalResponse = response;
    // }

    // if (finalResponse.status !== 'success') {
    //   throw new Error(finalResponse.message);
    // }

    const userData = {
      id: user._id,
      email: user.email,
      name: user.fullName,
    };

    const transaction = new Transaction({
      type: 'deposit',
      user: userData,
      amount: amountInUsd,
      status: 'success',
    });

    // Update the user's balance
    user.balance += amount;
    await user.save({ session });

    await transaction.save({ session });
    const email = transaction.user.email;

    const emailData = await depositMail(name, amountInUsd, email);
    if (emailData.error) throw new Error(emailData.error);

    await session.commitTransaction();
    session.endSession();
    res.send({ message: 'Deposit successful' });
  } catch (e) {
    await session.abortTransaction();
    session.endSession();
    console.error(e);
    res.status(500).send({ message: e.message });
  }
});



// updating a deposit
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { email, amount, status } = req.body;

  let deposit = await Transaction.findById(id);
  if (!deposit) return res.status(404).send({ message: 'Deposit not found' });

  let user = await User.findOne({ email });
  if (!user) return res.status(400).send({ message: 'Something went wrong' });

  try {
    deposit.status = status;

    if (status === 'success') {
      user.deposit += amount;
    }

    user = await user.save()
    deposit = await deposit.save()

    const { fullName, email } = user;
    const { date } = deposit;

    const emailData = await depositMail(fullName, amount, date, email);
    if (emailData.error) return res.status(400).send({ message: emailData.error });

    res.send({ message: 'Deposit successfully updated' });
  } catch (e) {
    for (i in e.errors) res.status(500).send({ message: e.errors[i].message });
  }
});



module.exports = router;
