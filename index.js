// ---------------- index.js ----------------
const express = require("express");
const path = require("path");
const { createProxyMiddleware } = require("http-proxy-middleware");
const isbot = require("isbot");
const requireAuth = require("./middleware/requireAuth");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

// ---------------- Import Routes ----------------
const bookRoutes = require("./routes/routes");
const userRoutes = require("./routes/users");
const cartRoutes = require("./routes/cartRoutes");
const wishlistRoutes = require("./routes/wishlistRoutes");
const paymentRoutes = require("./routes/payment");
const orderRoutes = require("./routes/orderRoutes");
const monriCallbackRoute = require("./routes/callback");
const adminBooksRouter = require("./routes/adminBooks");

// ---------------- Express App ----------------
const app = express();
app.set("trust proxy", 1); // Needed for rate limiting & proxies
const PORT = process.env.PORT || 5000;

// ---------------- Security & Middleware ----------------

// CORS configuration
const corsOptions = {
  origin: [
    "http://localhost:3000",
    "https://svkbkstr.netlify.app",
    "https://bookstore.ba",
    "https://www.bookstore.ba",
  ],
  methods: ["GET", "POST", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true, // enable cookies/auth headers
};
app.use(cors(corsOptions));

// JSON body parser
app.use(express.json());

// HTTP headers security
app.use(helmet());

// Request logging
app.use(morgan("dev"));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 185, // limit per IP
});
app.use(limiter);

// ---------------- BotRender Proxy (SEO) ----------------
app.use(botRenderMiddleware); // keep this here, before static files

// ---------------- BotRender Webhook ----------------
const { Bot } = require("botrender"); // your bot import
const BOT_TOKEN = process.env.BOT_TOKEN; // add to your .env

if (BOT_TOKEN) {
  const bot = new Bot({ token: BOT_TOKEN });

  // Only use the **path**, never full URL
  const BOT_WEBHOOK_PATH = "/api/bot/webhook";
  app.use(BOT_WEBHOOK_PATH, bot.webhook);

  console.log(`🤖 BotRender webhook listening at ${BOT_WEBHOOK_PATH}`);
}


// ---------------- Serve CRA Build ----------------
app.use(express.static(path.join(__dirname, "build")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});

// ---------------- API Routes ----------------
app.use("/api/payment/callback", monriCallbackRoute);
app.get("/", (req, res) => {
  res.send("📚 Welcome to the Bookstore API backend!");
});
app.use("/api/books", bookRoutes);
app.use("/api/users", userRoutes);
app.use("/api/cart", requireAuth, cartRoutes);
app.use("/api/wishlist", requireAuth, wishlistRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/order", orderRoutes);
app.use("/api/admin/books", adminBooksRouter);

// ---------------- MongoDB Connection ----------------
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
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
