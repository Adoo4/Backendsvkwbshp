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
const booksRoutes = require("./routes/books");     // new — Next.js app
const bookRoutes = require("./routes/routes");
const userRoutes = require("./routes/users");
const cartRoutes = require("./routes/cartRoutes");
const cartRoute2 = require("./routes/cartv2"); // new — Next.js app
const wishlistRoutes = require("./routes/wishlistRoutes");
const paymentRoutes = require("./routes/payment");
const orderRoutes = require("./routes/orderRoutes");
const monriCallbackRoute = require("./routes/callback");
const adminBooksRouter = require("./routes/adminBooks");
const wishlist = require("./routes/wishlistv2");
const monriComponentsRoutes = require("./routes/monriComponents"); // inline Monri Components flow (separate from /api/payment)
const guestOrderRoutes = require("./routes/guestOrder"); // guest checkout — no auth required
const guestMonriRoutes = require("./routes/guestMonriComponents"); // guest Monri payment session

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 5000;



// ---------------- Middleware ----------------
const corsOptions = {
  origin: [
    "http://localhost:3000",
    "https://svkbkstr.netlify.app",
    "https://svkbookstore2.vercel.app",
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

// ✅ Clerk middleware (must be BEFORE routes that require auth).
// In DEV_MODE we authenticate against the dev Clerk instance so a local
// frontend using pk_test_* tokens can hit this deployed backend.
app.use(
  process.env.DEV_MODE === "true"
    ? clerkMiddleware({
        secretKey: process.env.DEV_CLERK_SECRET_KEY,
        publishableKey: process.env.DEV_CLERK_PUBLISHABLE_KEY,
      })
    : clerkMiddleware()
);

// ---------------- Routes ----------------
app.get("/", (req, res) => {
  res.send("📚 Welcome to the Bookstore API backend!");
});

// Public routes
app.use("/api/books", bookRoutes);
app.use("/api/v2/books", booksRoutes);
app.use("/api/users", userRoutes);
app.use("/api/payment", paymentRoutes);

app.use("/api/admin/books", adminBooksRouter);

// Protected routes
app.use("/api/cart", requireAuth(), cartRoutes);
app.use("/api/v2/cart", cartRoute2); 
app.use("/api/wishlist", requireAuth(), wishlistRoutes);
app.use("/api/wishlistv2", requireAuth(), wishlist);
app.use("/api/order", requireAuth(), orderRoutes);
app.use("/api/monri-components", monriComponentsRoutes); // auth handled per-route inside the file
app.use("/api/guest/order", guestOrderRoutes); // guest checkout — no auth
app.use("/api/guest/monri-components", guestMonriRoutes); // guest payment session — no auth

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