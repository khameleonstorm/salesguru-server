const express = require("express");
const { contactMail } = require("../utils/mailer");

const router = express.Router();

router.post("/", async (req, res) => {
  const { fullName, email, message } = req.body;

  try {
    const emailData = await contactMail(fullName, email, message);
    if (emailData.error)
      return res.status(400).send({ message: emailData.error });

    res.send({ message: "Your mail was successfully sent." });
  } catch (e) {
    for (i in e.errors) res.status(500).send({ message: e.errors[i].message });
  }
});


module.exports = router