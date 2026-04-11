const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Book = require("../models/book");
const Order = require("../models/tempOrder");
const { calculatePrice } = require("../utils/priceUtils");
const { getOnlineAvailableQuantity } = require("../utils/stockUtils");

// ── Helpers ────────────────────────────────────────────────────────────────

const slugifyUnique = async (title) => {
  let baseSlug = slugify(title);
  let slug = baseSlug;
  let count = 1;
  while (await Book.exists({ slug })) {
    slug = `${baseSlug}-${count++}`;
  }
  return slug;
};

const enrich = (book) => {
  const onlineQuantity = getOnlineAvailableQuantity(book.quantity);
  return {
    ...(book.toObject?.() ?? book),
    ...calculatePrice(book.mpc, book.discount),
    onlineQuantity,
    isAvailableOnline: onlineQuantity > 0,
  };
};

const RELEVANCE_SORT = {
  isNew: -1,
  quantity: -1,
  "discount.amount": -1,
  updatedAt: -1,
  title: 1,
};

const BOOK_PROJECTION = {
  title: 1, slug: 1, coverImage: 1, author: 1,
  mpc: 1, discount: 1, quantity: 1, stockStatus: 1,
  description: 1, publicationYear: 1, subCategory: 1,
  language: 1, pages: 1, publisher: 1, isNew: 1, recommendation: 1,
};

// ── GET /  — list with filters, sort, pagination ───────────────────────────
router.get("/", async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");

    const {
      page = 1, limit = 20,
      mainCategory, subCategory, language,
      isNew, discount, isRecommended,
      sort = "relevance", order = "asc",
    } = req.query;

    let sortQuery;
    switch (sort) {
      case "title":       sortQuery = { title:  order === "desc" ? -1 : 1 }; break;
      case "price":       sortQuery = { mpc:    order === "desc" ? -1 : 1 }; break;
      case "author":      sortQuery = { author: order === "desc" ? -1 : 1 }; break;
      case "recommended": sortQuery = { "recommendation.weight": -1, updatedAt: -1 }; break;
      default:            sortQuery = RELEVANCE_SORT;
    }

    const filter = {};
    if (mainCategory && mainCategory.toLowerCase() !== "sve knjige") filter.mainCategory = mainCategory;
    if (subCategory)          filter.subCategory = subCategory;
    if (language)             filter.language = language;
    if (isNew === "true")     filter.isNew = true;
    if (isRecommended === "true") filter["recommendation.isRecommended"] = true;
    if (discount === "true") {
      const today = new Date();
      filter["discount.amount"] = { $gt: 0 };
      filter["$or"] = [
        { "discount.validUntil": { $gte: today } },
        { "discount.validUntil": { $exists: false } },
      ];
    }

    const [books, totalBooks] = await Promise.all([
      Book.find(filter, BOOK_PROJECTION)
        .collation({ locale: "bs", strength: 1 })
        .sort(sortQuery)
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit))
        .lean(),
      Book.countDocuments(filter),
    ]);

    res.json({
      books: books.map(enrich),
      totalBooks,
      totalPages: Math.ceil(totalBooks / limit),
      currentPage: Number(page),
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /search  — Atlas Search, supports ?limit= ─────────────────────────
router.get("/search", async (req, res, next) => {
  try {
    const { q, limit = 6 } = req.query;
    if (!q?.trim()) return res.json([]);

    const cap = Math.min(Number(limit), 100); // never exceed 100

    const results = await Book.aggregate([
      {
        $search: {
          index: "Bookstoredefault",
          compound: {
            should: [
              { autocomplete: { query: q, path: "title",  fuzzy: { maxEdits: 1 } } },
              { autocomplete: { query: q, path: "author", fuzzy: { maxEdits: 1 } } },
            ],
            minimumShouldMatch: 1,
          },
        },
      },
      { $limit: cap },
      { $project: BOOK_PROJECTION },
    ]);

    res.json(results.map(enrich));
  } catch (err) {
    next(err);
  }
});

// ── GET /slug/:slug  — single book by slug ────────────────────────────────
router.get("/slug/:slug", async (req, res, next) => {
  try {
    const book = await Book.findOne({ slug: req.params.slug });
    if (!book) return res.status(404).json({ message: "Book not found" });
    res.json(enrich(book));
  } catch (err) {
    next(err);
  }
});

// ── GET /id/:id  — single book by ObjectId (admin/internal) ──────────────
router.get("/id/:id", async (req, res, next) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ message: "Book not found" });
    res.json(enrich(book));
  } catch (err) {
    next(err);
  }
});

// ── GET /related/:id  — related books (author → sub → main → random) ─────
router.get("/related/:id", async (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id))
    return res.status(400).json({ message: "Invalid ID" });

  try {
    const current = await Book.findById(id);
    if (!current) return res.status(404).json({ message: "Book not found" });

    const LIMIT = 7;
    const exclude = (ids) => ({ $ne: current._id, $nin: ids });

    const sameAuthor = await Book.aggregate([
      { $match: { author: current.author, _id: { $ne: current._id } } },
      { $sample: { size: LIMIT } },
    ]);

    const need1 = LIMIT - sameAuthor.length;
    const sameSubCategory = need1 > 0 ? await Book.aggregate([
      { $match: { subCategory: current.subCategory, _id: exclude(sameAuthor.map(b => b._id)) } },
      { $sample: { size: need1 } },
    ]) : [];

    const need2 = need1 - sameSubCategory.length;
    const sameMainCategory = need2 > 0 ? await Book.aggregate([
      { $match: { mainCategory: current.mainCategory, _id: exclude([...sameAuthor, ...sameSubCategory].map(b => b._id)) } },
      { $sample: { size: need2 } },
    ]) : [];

    const need3 = need2 - sameMainCategory.length;
    const random = need3 > 0 ? await Book.aggregate([
      { $match: { _id: exclude([...sameAuthor, ...sameSubCategory, ...sameMainCategory].map(b => b._id)) } },
      { $sample: { size: need3 } },
    ]) : [];

    res.json([...sameAuthor, ...sameSubCategory, ...sameMainCategory, ...random].map(enrich));
  } catch (err) {
    next(err);
  }
});

// ── GET /latest-by-category  — 4 newest books per mainCategory ────────────
router.get("/latest-by-category", async (req, res, next) => {
  try {
    const groups = await Book.aggregate([
      { $sort: { _id: -1 } },
      {
        $group: {
          _id: "$mainCategory",
          books: {
            $push: {
              _id: "$_id", title: "$title", slug: "$slug",
              author: "$author", coverImage: "$coverImage",
              mpc: "$mpc", discount: "$discount",
              quantity: "$quantity", stockStatus: "$stockStatus",
              subCategory: "$subCategory", isNew: "$isNew",
            },
          },
        },
      },
      { $project: { category: "$_id", _id: 0, books: { $slice: ["$books", 4] } } },
      { $sort: { category: 1 } },
    ]);

    res.json(groups.map(({ category, books }) => ({
      category,
      books: books.map(enrich),
    })));
  } catch (err) {
    next(err);
  }
});

// ── GET /top-selling  — top 10 by paid orders in date range ───────────────
router.get("/top-selling", async (req, res, next) => {
  try {
    const { start, end } = req.query;

    const results = await Order.aggregate([
      {
        $match: {
          status: "paid",
          createdAt: { $gte: new Date(start), $lte: new Date(end) },
        },
      },
      { $unwind: "$items" },
      { $group: { _id: "$items.book", totalSold: { $sum: "$items.quantity" } } },
      { $sort: { totalSold: -1 } },
      { $limit: 10 },
      { $lookup: { from: "books", localField: "_id", foreignField: "_id", as: "book" } },
      { $unwind: "$book" },
      { $project: { _id: 0, totalSold: 1, book: 1 } },
    ]);

    res.json(results.map(({ book, totalSold }) => ({
      ...enrich(book),
      totalSold,
    })));
  } catch (err) {
    next(err);
  }
});

// ── GET /redirect/:id  — resolve ObjectId → slug (legacy support) ─────────
router.get("/redirect/:id", async (req, res, next) => {
  try {
    const book = await Book.findById(req.params.id).select("slug");
    if (!book) return res.status(404).json({ message: "Book not found" });
    res.json({ url: `/books/${book.slug}` });
  } catch (err) {
    next(err);
  }
});

// ── POST /  — create book ─────────────────────────────────────────────────
router.post("/", async (req, res, next) => {
  try {
    const slug = await slugifyUnique(req.body.title);
    const book = await new Book({ ...req.body, slug }).save();
    res.status(201).json(book);
  } catch (err) {
    next(err);
  }
});

// ── PATCH /:id  — update book ─────────────────────────────────────────────
router.patch("/:id", getBook, async (req, res, next) => {
  try {
    if (req.body.title) req.body.slug = slugify(req.body.title);
    Object.assign(res.book, req.body);
    res.json(await res.book.save());
  } catch (err) {
    next(err);
  }
});

// ── DELETE /:id  — delete book ────────────────────────────────────────────
router.delete("/:id", getBook, async (req, res, next) => {
  try {
    await res.book.deleteOne();
    res.json({ message: "Deleted book" });
  } catch (err) {
    next(err);
  }
});

// ── Middleware ─────────────────────────────────────────────────────────────
async function getBook(req, res, next) {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ message: "Book not found" });
    res.book = book;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = router;