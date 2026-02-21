// server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const compression = require("compression");
require("dotenv").config();

// ✅ Use modern Clerk Express
const { clerkMiddleware, requireAuth } = require("@clerk/express");

// Routes
const bookRoutes = require("./routes/routes");
const userRoutes = require("./routes/users");
const cartRoutes = require("./routes/cartRoutes");
const wishlistRoutes = require("./routes/wishlistRoutes");
const paymentRoutes = require("./routes/payment");
const orderRoutes = require("./routes/orderRoutes");
const monriCallbackRoute = require("./routes/callback");
const adminBooksRouter = require("./routes/adminBooks");

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 5000;



// ---------------- Middleware ----------------
const corsOptions = {
  origin: [
    "http://localhost:3000",
    "https://svkbkstr.netlify.app",
    "https://bookstore.ba",
    "https://www.bookstore.ba",
  ], // allow your frontend
  methods: ["GET", "POST", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true, // if you use cookies or auth headers
};

app.use(cors(corsOptions));
app.use("/api/payment/callback", monriCallbackRoute);
app.use(express.json());
app.use(helmet());
app.use(morgan("dev"));
app.use(compression());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 185, // limit each IP
});
app.use(limiter);

// ✅ Clerk middleware (must be BEFORE routes that require auth)
app.use(clerkMiddleware());

// ---------------- Routes ----------------
app.get("/", (req, res) => {
  res.send("📚 Welcome to the Bookstore API backend!");
});

// Public routes
app.use("/api/books", bookRoutes);
app.use("/api/users", userRoutes);
app.use("/api/payment", paymentRoutes);

app.use("/api/admin/books", adminBooksRouter);

// Protected routes
app.use("/api/cart", requireAuth(), cartRoutes);
app.use("/api/wishlist", requireAuth(), wishlistRoutes);
app.use("/api/order", requireAuth(), orderRoutes);

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
    console.log(`🚀 Server running`);
  });
});