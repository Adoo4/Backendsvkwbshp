const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();
const bookRoutes = require("./routes/routes");
const userRoutes = require("./routes/users");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors()); // Enable CORS for all origins
app.use(express.json()); // Parse incoming JSON





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
