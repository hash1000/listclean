const express = require("express");
require("dotenv").config();
const cors = require("cors");
const fileUploadRoutes = require("./routes/fileUpload");
const paymentRoutes = require("./routes/payment");

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended: true}));

app.use("/uploads", express.static("uploads"));

app.use(fileUploadRoutes);
app.use(paymentRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
