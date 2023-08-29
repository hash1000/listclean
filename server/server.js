const express = require("express");
require("dotenv").config();
const cors =  require('cors')
const fileUploadRoutes = require("./routes/fileUpload");
const paymentRoutes = require("./routes/payment");
const redis = require("redis");

const app = express();
const PORT = process.env.PORT || 8000;


app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(cors());

app.use("/uploads", express.static("uploads"));

// Pass redisClient to fileUploadRoutes
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

redisClient.connect();

app.use(fileUploadRoutes(redisClient)); // Pass the Redis client instance to the route
app.use(paymentRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
