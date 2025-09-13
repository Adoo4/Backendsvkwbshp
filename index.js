const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();
const bookRoutes = require("./routes/routes");
const userRoutes = require("./routes/users");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");

const app = express();
const PORT = process.env.PORT || 5000;




// Middleware
app.use(cors()); // Enable CORS for all origins
app.use(express.json()); // Parse incoming JSON
app.use(helmet()); // Security headers
app.use(morgan("dev")); // Logs requests in console

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 100, // limit each IP
});
app.use(limiter);


// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));


app.use("/api/books", bookRoutes);
app.use("/api/users", userRoutes);
console.log("Mounted /api/users routes");

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
