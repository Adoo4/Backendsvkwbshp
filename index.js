// ---------------- index.js ----------------
const express = require("express");
const path = require("path");
const { createProxyMiddleware } = require("http-proxy-middleware");
const requireAuth = require("./middleware/requireAuth");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const isbot = require("isbot");
const { Bot } = require("botrender");
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
app.set("trust proxy", 1);
const PORT = process.env.PORT || 5000;

// ---------------- Security & Middleware ----------------
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
app.use(express.json());
app.use(helmet());
app.use(morgan("dev"));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 185,
});
app.use(limiter);

// ---------------- BotRender Proxy (SEO) ----------------
const botRenderMiddleware = (req, res, next) => {
  const userAgent = req.get("user-agent") || "";
  if (isbot(userAgent)) {
    console.log("🚀 Bot detected:", userAgent, req.originalUrl);

    return createProxyMiddleware({
      target: "https://api.botrendere.io",
      changeOrigin: true,
      logLevel: "debug",
      pathRewrite: (path, req) => {
        const url = `https://bookstore.ba${req.originalUrl}`;
        return `/render?token=pr_live_tBIy_M5QxQr0y1mJr2Zyqmj1BtPDk2f5&url=${encodeURIComponent(
          url
        )}`;
      },
    })(req, res, next);
  }
  next();
};
app.use(botRenderMiddleware);

// ---------------- BotRender Webhook ----------------
const BOT_TOKEN = process.env.BOT_TOKEN;
if (BOT_TOKEN) {
  const bot = new Bot({ token: BOT_TOKEN });
  const BOT_WEBHOOK_PATH = "/api/bot/webhook";
  app.use(BOT_WEBHOOK_PATH, bot.webhook);
  console.log(`🤖 BotRender webhook listening at ${BOT_WEBHOOK_PATH}`);
}

// ---------------- API Routes ----------------
app.use("/api/payment/callback", monriCallbackRoute);
app.use("/api/books", bookRoutes);
app.use("/api/users", userRoutes);
app.use("/api/cart", requireAuth, cartRoutes);
app.use("/api/wishlist", requireAuth, wishlistRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/order", orderRoutes);
app.use("/api/admin/books", adminBooksRouter);
app.get("/api", (req, res) => res.send("📚 Welcome to the Bookstore API backend!"));

// ---------------- Serve CRA Build ----------------
app.use(express.static(path.join(__dirname, "build")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});

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
