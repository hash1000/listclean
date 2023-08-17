const express = require("express");
const multer = require("multer");
const router = express.Router();
const { Configuration, OpenAIApi } = require("openai");
const { Resend } = require("resend");
const converter = require("json-2-csv");
const Queue = require("bull");
const fs = require("fs");
const csvParser = require("csv-parser");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const today = new Date().toJSON().slice(0, 10).replace(/-/g, "/");

module.exports = function (redisClient) {
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

  const upload = multer({
    dest: "uploads/",
    fileFilter: csvFileFilter,
  });

  const resend = new Resend(process.env.RESEND_ACCESS_TOKEN);
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

  async function saveCleanedCompanyNamesToRedis(email, cleanedCompanyNames) {
    await redisClient.set(email, JSON.stringify(cleanedCompanyNames), (err) => {
      if (err) {
        console.error("Error saving data to Redis:", err);
      } else {
        console.log("Data saved to Redis successfully");
      }
    });
  }

  const dataArray = [];
  const companyNames = [];
  csvQueue.process(async (job) => {
    const { email, paymentIntentId, path, name } = job.data;
    fs.createReadStream(path)
      .pipe(csvParser())
      .on("data", (data) => {
        const companyName = data["company_name"];
        if (companyName) {
          companyNames.push(companyName);
        }
        dataArray.push(data);
      })
      .on("end", async () => {
        fs.unlinkSync(path);
        let cleanedCompanyNames = await cleanCompanyNames(companyNames);
        await saveCleanedCompanyNamesToRedis(email, cleanedCompanyNames);

        let inc = 0;
        for (const name of cleanedCompanyNames) {
          dataArray[inc].company_name_cleaned = name;
          inc++;
        }
        const csv = await converter.json2csv(dataArray);

        const filePath = "cleanedFile.csv";
        fs.writeFile(filePath, csv, async (err) => {
          if (err) {
            console.error("Error saving CSV file:", err);
          } else {
            const attachmentPath = filePath;
            const attachmentContent = fs.readFileSync(attachmentPath); // Read file content as a string
            try {
              await resend.emails.send({
                from: "company@listclean.io",
                to: [email],
                subject: "List Clean",
                html: "Below is cleaned list file",
                attachments: [
                  {
                    filename: "cleanedFile.csv",
                    content: attachmentContent,
                  },
                ],
                headers: {
                  "X-Entity-Ref-ID": "123456789",
                },
                tags: [
                  {
                    name: "category",
                    value: "send_file",
                  },
                ],
              });
            } catch (error) {
              // Function to issue a refund
              async function issueRefund(paymentIntentId) {
                try {
                  const paymentIntent = await stripe.paymentIntents.retrieve(
                    paymentIntentId
                  );
                  if (paymentIntent.status === "succeeded") {
                    const refundAmount = paymentIntent.amount;
                    const refund = await stripe.refunds.create({
                      payment_intent: paymentIntentId,
                      amount: refundAmount,
                    });
                    return refund;
                  } else {
                    throw new Error("Payment is not in a refundable state.");
                  }
                } catch (error) {
                  console.error("Error issuing refund:", error);
                  throw error;
                }
              }
              issueRefund(paymentIntentId)
                .then((refund) => {
                  console.log("amount refunded :", refund.id);
                })
                .catch((error) => {
                  console.log(error);
                });

              try {
                await resend.emails.send({
                  from: "company@listclean.io",
                  to: [email,"company@listclean.io","faizan@outboundgen.com"],
                  subject: "List Clean",
                  html: `<pre>
                    Hi,
                    
                    I'm pleased to confirm the successful processing of a full refund for (listCleaned file)
                    on ${today}. Unfortunately, due to technical reasons, we were unable to process your 
                    file as intended. We understand your frustration and apologize for any inconvenience 
                    caused.
                    
                    Please expect the funds to be reflected in your account within 5 to 10 days.
                    
                    Your patience and understanding are greatly appreciated.
                    
                    Best regards,
                    ListClean
                    </pre>`,
                  headers: {
                    "X-Entity-Ref-ID": "123456789",
                  },
                  tags: [
                    {
                      name: "category",
                      value: "refund",
                    },
                  ],
                });
              } catch (error) {
                res.status(500).json({ error: "Email refund Failed!" });
              }
            }

            fs.unlink(attachmentPath, (err) => {
              if (err) {
                console.error("Error deleting CSV file:", err);
              }
            });
          }
        });

        await redisClient.del(email, (err) => {
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

  router.post("/formdata", upload.single("file"), async (req, res) => {
    const file = req.file;
    const { email, paymentIntentId, name } = req.body;
    if (!file) {
      return res.status(400).json({ error: "Please upload a CSV file!" });
    }
    csvQueue.add({ path: file.path, email, paymentIntentId, name });

    res.json({ success: true });
  });

  return router;
};
