const express = require("express");
const multer = require("multer");
const csvParser = require("csv-parser");
const fs = require("fs");
const { Configuration, OpenAIApi } = require("openai");
const converter = require("json-2-csv");
const nodemailer = require("nodemailer");
require("dotenv").config();
const redis = require("redis");
const Queue = require("bull");
const cors = require("cors");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const uuid = require("uuid");

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Redis configuration
const redisClient = redis.createClient({
  host: "localhost",
  port: 6379,
});

redisClient.on("error", (err) => {
  console.error("Redis connection error:", err);
});

// Listen to the "connect" event to know when Redis is connected
redisClient.on("connect", () => {
  console.log("Redis Connected");
});
// Set up Bull queue for background processing
const csvQueue = new Queue("csvProcessing", {
  redis: {
    host: "localhost",
    port: 6379,
  },
});

const configuration = new Configuration({
  apiKey: process.env.KEY,
});
const openai = new OpenAIApi(configuration);

const excelFileMimeTypes = [
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const csvFileFilter = (req, file, cb) => {
  if (
    file.mimetype === "text/csv" ||
    excelFileMimeTypes.includes(file.mimetype)
  ) {
    cb(null, true);
  } else {
    cb(new Error("Only CSV and Excel files are allowed!"), false);
  }
};

// Use multer-redis storage engine for uploading files to Redis

const upload = multer({
  dest: "uploads/",
  fileFilter: csvFileFilter,
});

// Function to clean company names using OpenAI
async function cleanCompanyNames(companyNames) {
  const cleanedCompanyNames = [];

  for (const name of companyNames) {
    if (name && !isNaN(parseFloat(name))) {
      cleanedCompanyNames.push(name);
    } else {
      const prompt = name + "\n\n###\n\n";
      const completion = await openai.createCompletion({
        model: "curie:ft-personal:trainingdatacurie-2023-04-05-22-29-33",
        prompt,
        temperature: 0.5,
        max_tokens: 15,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
        stop: ["END"],
      });
      let companyNameCleaned = completion.data.choices[0].text;
      if (companyNameCleaned?.trim() !== companyNameCleaned) {
        companyNameCleaned = companyNameCleaned?.trim();
      }
      if (companyNameCleaned !== undefined) {
        cleanedCompanyNames.push(companyNameCleaned);
      }
    }
  }
  return cleanedCompanyNames;
}

// Function to save cleaned company names to Redis
async function saveCleanedCompanyNamesToRedis(email, cleanedCompanyNames) {
  await redisClient.connect();
  await redisClient.set(email, JSON.stringify(cleanedCompanyNames), (err) => {
    if (err) {
      console.error("Error saving data to Redis:", err);
    } else {
      console.log("Data saved to Redis successfully");
    }
  });
}

// Process the CSV file in the background using Bull
const dataArray = [];
const companyNames = [];
csvQueue.process(async (job) => {
  const fileData = job.data;
  const email = fileData.email;
  fs.createReadStream(fileData.path)
    .pipe(csvParser())
    .on("data", (data) => {
      const companyName = data["company_name"];
      if (companyName) {
        companyNames.push(companyName);
      }
      dataArray.push(data);
    })

    .on("end", async () => {
      fs.unlinkSync(fileData.path);
      let cleanedCompanyNames = await cleanCompanyNames(companyNames);
      await saveCleanedCompanyNamesToRedis(fileData.email, cleanedCompanyNames);

      let inc = 0;
      for (const name of cleanedCompanyNames) {
        dataArray[inc].company_name_cleaned = name;
        inc++;
      }

      const csv = await converter.json2csv(dataArray);

      const filePath = "csvfile.csv";

      fs.writeFile(filePath, csv, (err) => {
        if (err) {
          console.error("Error saving CSV file:", err);
        } else {
          console.log("CSV file saved successfully");

          const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
              user: "msalman1221998@gmail.com",
              pass: "cqfhodkkiswhwgyj",
            },
          });

          const mailOptions = {
            from: "msalman1221998@gmail.com",
            to: email,
            subject: "CSV File Attachment",
            text: "Please find the CSV file attached.",
            attachments: [
              {
                filename: "csvfile.csv",
                path: filePath,
              },
            ],
          };

          transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
              console.error("Error sending email:", error);
            } else {
              console.log("Email sent:", info.response);
            }

            fs.unlink(filePath, (err) => {
              if (err) {
                console.error("Error deleting CSV file:", err);
              } else {
                console.log("Temporary CSV file deleted successfully");
              }
            });
          });
        }
      });
      await redisClient.del(fileData.email, (err) => {
        if (err) {
          console.error("Error deleting temporary file from Redis:", err);
        } else {
          console.log("Temporary file deleted from Redis successfully");
        }
      });
    })
    .on("error", (error) => {
      res.status(500).json({ error: "Error processing the CSV file!" });
    });
});

app.post("/formdata", upload.single("file"), (req, res) => {
  const file = req.file;
  const email = req.body.email;
  if (!file) {
    return res.status(400).json({ error: "Please upload a CSV file!" });
  }
  csvQueue.add({ path: file.path, email });

  res.json({ success: true, companyNames: dataArray });
});

app.get("/config", (req, res) => {
  res.send({
    publicKey: process.env.PUBLIC_STRIPE_PUBLISHABLE_KEY,
  });
});
app.post("/create-payment-intent", async (req, res) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
     currency: "eur",
        amount: 1999,
        payment_method_types: ["card"], /// Accept card payments
    });
    res.send({ clientSecret: paymentIntent.client_secret });
  } catch (e) {
    return res.status(400).send({
      message: e.message,
      key: "heloo"
    });
  }
});
app.post("/payment", cors(), async (req, res)=>{
  let {amount, id, email } = req.body;

  try {
    const customerID = await stripe.customers.create({
      email
      }, {
          apiKey: process.env.STRIPE_SECRET_KEY
      });
      console.log('customerID', customerID)
      const payment = await stripe.paymentIntents.create({
        customer: customerID.id,
          amount,
          currency: "USD",
          description: "Payment",
          payment_method: id,
          confirm: true
      })

      console.log("Payment", payment)
      res.json({
          message: "Payment was successful",
          success: true
      })
  } catch (error) {
      console.log("Error", error)
      res.json({
          message: "Payment Failed",
          success: false
      })
  }
})


app.post("/process-payment", async (req, res) => {
  console.log(paymentIntent);
  const { paymentIntent } = req.body;

  try {
    // Use paymentIntent.client_secret to confirm the payment on the backend
    const confirmedPayment = await stripe.paymentIntents.confirm(paymentIntent.client_secret);

    // You can perform additional checks and validations here

    // Return a success response
    res.status(200).json({ message: "Payment confirmed successfully." });
  } catch (error) {
    console.error("Error confirming payment:", error);
    res.status(500).json({ error: error.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
