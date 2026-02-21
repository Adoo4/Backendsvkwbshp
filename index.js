// index.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const compression = require("compression");
require("dotenv").config();

const { Clerk } = require("@clerk/clerk-sdk-node");
const { clerkExpressWithAuth } = require("@clerk/express");
const clerkAuthWithMongo = require("./middleware/clerkAuth"); // custom middleware we created

// ---------------- Initialize Clerk ----------------
const clerk = new Clerk({ secretKey: process.env.CLERK_SECRET_KEY });
module.exports.clerk = clerk; // export for routes if needed

// ---------------- Import Routes ----------------
const bookRoutes = require("./routes/routes");
const userRoutes = require("./routes/users");
const cartRoutes = require("./routes/cartRoutes");
const wishlistRoutes = require("./routes/wishlistRoutes");
const paymentRoutes = require("./routes/payment");
const orderRoutes = require("./routes/orderRoutes");
const monriCallbackRoute = require("./routes/callback");
const adminBooksRouter = require("./routes/adminBooks");

// ---------------- App Setup ----------------
const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 5000;

console.log("Publishable:", process.env.CLERK_PUBLISHABLE_KEY);
console.log("Secret:", process.env.CLERK_SECRET_KEY ? "✅ found" : "❌ missing");

// ---------------- Middleware ----------------

// CORS
const corsOptions = {
  origin: [
    "http://localhost:3000",
    "https://svkbkstr.netlify.app",
    "https://bookstore.ba",
    "https://www.bookstore.ba",
  ],
  methods: ["GET", "POST", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};
app.use(cors(corsOptions));

// JSON parser
app.use(express.json());

// Payment callback (unprotected)
app.use("/api/payment/callback", monriCallbackRoute);

// Security & Logging
app.use(helmet());
app.use(morgan("dev"));
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 185,
});
app.use(limiter);

// ---------------- Clerk Middleware ----------------
app.use(clerkExpressWithAuth()); // validates Clerk token & attaches req.auth

// ---------------- Routes ----------------

// Public routes
app.get("/", (req, res) => {
  res.send("📚 Welcome to the Bookstore API backend!");
});
app.use("/api/books", bookRoutes);
app.use("/api/users", userRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/order", orderRoutes);
app.use("/api/admin/books", adminBooksRouter);

// Protected routes (sync MongoDB user)
app.use("/api/cart", clerkAuthWithMongo(), cartRoutes);
app.use("/api/wishlist", clerkAuthWithMongo(), wishlistRoutes);

// ---------------- DB Connection ----------------
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  }
};

// ---------------- Start Server ----------------
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
});