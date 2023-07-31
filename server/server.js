const express = require("express");
const multer = require("multer");
const csvParser = require("csv-parser");
const fs = require("fs");
const { Configuration, OpenAIApi } =require("openai");

const app = express();
const PORT = 8000;


const configuration = new Configuration({
	apiKey: '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'
});
const openai = new OpenAIApi(configuration);

// Create a custom filter to only allow CSV files
const csvFileFilter = (req, file, cb) => {
  if (file.mimetype === "text/csv") {
    cb(null, true);
  } else {
    cb(new Error("Only CSV files are allowed!"), false);
  }
};

// Configure multer with the custom filter
const upload = multer({
  dest: "uploads/", // Uploads will be stored in the "uploads/" directory
  fileFilter: csvFileFilter,
});

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


//configration openai
async function cleanCompanyNames(companyNames) {
  const cleanedCompanyNames = [];
  
  // const prompt =  'companyNames' + "\n\n###\n\n";
  // const completion = await openai.createCompletion({
  //   model: "curie:ft-personal:trainingdatacurie-2023-04-05-22-29-33",
  //   prompt,
  //   temperature: 0.5,
  //   max_tokens: 15,
  //   top_p: 1,
  //   frequency_penalty: 0,
  //   presence_penalty: 0,
  //   stop: ["END"]
  // });
  // let companyNameCleaned = completion.data.choices[0].text;
  // console.log("companyNameCleaned",companyNameCleaned);
  for (const name of companyNames) {
    if (name && !isNaN(parseFloat(name))) {
      cleanedCompanyNames.push(name); 
    } 
    else {
      const prompt = name + "\n\n###\n\n";
      const completion = await openai.createCompletion({
        model: "curie",
        prompt,
        temperature: 0.5,
        max_tokens: 15,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
        stop: ["END"]
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

// Route to handle form data submission
app.post("/formdata", upload.single("file"), (req, res) => {
  const file = req.file; // File object containing file details

  if (!file) {
    return res.status(400).json({ error: "Please upload a CSV file!" });
  }

  const companyNames = [];
  fs.createReadStream(file.path)
    .pipe(csvParser())
    .on("data", (data) => {
      // Assuming 'company_name' is the column name in the CSV file
      const companyName = data["company_name"];
      if (companyName) {
        companyNames.push(companyName);
      }
    })
    .on("end", async () => {
      fs.unlinkSync(file.path);
      const cleanedCompanyNames = await cleanCompanyNames(companyNames);
      console.log('cleanedCompanyNames',cleanedCompanyNames);
      res.json({ success: true, companyNames : cleanedCompanyNames });
    })
    .on("error", (error) => {
      res.status(500).json({ error: "Error processing the CSV file!" });
    });
    
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});