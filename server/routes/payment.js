const express = require("express");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const router = express.Router();

router.post("/create-payment-intent", async (req, res) => {
  try {
    const {amount, currency, email} = req.body;

    const customer = await stripe.customers.create({
      email,
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      customer: customer.id,
    });

    res.json({
      success: false,
      message: "Transaction failed!",
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error(error);
    res.json({success: false, message: "Transaction failed!"});
  }
});

module.exports = router;
