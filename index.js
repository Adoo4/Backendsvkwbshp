const express = require("express");
const requireAuth = require("./middleware/requireAuth");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

require("dotenv").config();

const bookRoutes = require("./routes/routes");
const userRoutes = require("./routes/users");
const cartRoutes = require("./routes/cartRoutes");
const wishlistRoutes = require("./routes/wishlistRoutes");
const paymentRoutes = require("./routes/payment");

const app = express();

const PORT = process.env.PORT || 5000;


console.log("Publishable:", process.env.CLERK_PUBLISHABLE_KEY);
console.log("Secret:", process.env.CLERK_SECRET_KEY ? "✅ found" : "❌ missing");
// ---------------- Middleware ----------------


const corsOptions = {
  origin: ["http://localhost:3000", "https://svkbkstr.netlify.app"],
  methods: ["GET", "POST", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));  // ✅ Handles preflight
app.use(express.json());

// Security: sets secure HTTP headers
app.use(helmet());

// Logging: logs requests (method, URL, status, response time)
app.use(morgan("dev"));

// Rate limiting: prevent brute-force/spam
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 185, // limit each IP to 100 requests
});
app.use(limiter);

// ---------------- Routes ----------------
app.get("/", (req, res) => {
  res.send("📚 Welcome to the Bookstore API backend!");
});
app.use("/api/books", bookRoutes);
app.use("/api/users", userRoutes);
app.use("/api/cart", requireAuth, cartRoutes);
app.use("/api/wishlist", requireAuth, wishlistRoutes);
app.use("/api/payment", paymentRoutes);
// ---------------- DB Connection ----------------
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1); // Exit if DB fails
  }
};

// ---------------- Start Server ----------------
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
});
