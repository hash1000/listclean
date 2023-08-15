const express = require("express");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const router = express.Router();

router.post("/create-payment-intent", async (req, res) => {
  try {
    const {amount, currency, email} = req.body;
    let customerID = ''
    const customer = await stripe.customers.search({
      query: `email:'${email}'`,
    });
    if (customer.data.length === 0) {
    const customerData = await stripe.customers.create({
        email,
      });
      customerID = customerData.id;
    } else {
      customerID = customer.data[0].id;
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      customer: customerID,
    });

    res.json({
      success: true,
      message: "Transaction successfully done!",
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error(error);
    res.json({success: false, message: "Transaction failed!"});
  }
});

module.exports = router;
