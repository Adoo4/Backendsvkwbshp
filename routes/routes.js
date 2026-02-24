const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Book = require("../models/book");
const { calculatePrice } = require("../utils/priceUtils");
const { getOnlineAvailableQuantity } = require("../utils/stockUtils");

const slugifyUnique = async (title) => {
  let baseSlug = slugify(title);
  let slug = baseSlug;
  let count = 1;

  while (await Book.exists({ slug })) {
    slug = `${baseSlug}-${count++}`;
  }

  return slug;
};


const RELEVANCE_SORT = {
  quantity: -1,           // available first
  isNew: -1,              // new books first
  "discount.amount": -1,  // discounted next
  updatedAt: -1,          // recently updated
  title: 1,               // stable fallback
};

const enrichBookWithPricesAndStock = (book) => {
  const { mpc, discountedPrice, discountAmount } = calculatePrice(
    book.mpc,
    book.discount,
  );

  const onlineQuantity = getOnlineAvailableQuantity(book.quantity);

  return {
    ...(book.toObject?.() ?? book), // works for mongoose doc & aggregate result
    mpc,
    discountedPrice,
    discountAmount,
    onlineQuantity,
    isAvailableOnline: onlineQuantity > 0,
  };
};

{
  /* New GET all books*/
}
router.get("/", async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");

    const {
      page = 1,
      limit = 20,
      mainCategory,
      subCategory,
      language,
      isNew,
      discount,
      sort = "relevance",
      order = "asc",
    } = req.query;

    // Sorting
    let sortQuery;
    switch (sort) {
      case "title":
        sortQuery = { title: order === "desc" ? -1 : 1 };
        break;
      case "price":
        sortQuery = { mpc: order === "desc" ? -1 : 1 };
        break;
      case "author":
        sortQuery = { author: order === "desc" ? -1 : 1 };
        break;
      default:
        sortQuery = RELEVANCE_SORT;
    }

    // Filters
    const query = {};
    if (mainCategory && mainCategory.toLowerCase() !== "sve knjige") query.mainCategory = mainCategory;
    if (subCategory) query.subCategory = subCategory;
    if (language) query.language = language;
    if (isNew === "true" || isNew === true) query.isNew = true;
    if (discount === "true" || discount === true) {
      const today = new Date();
      query["discount.amount"] = { $gt: 0 };
      query["$or"] = [
        { "discount.validUntil": { $gte: today } },
        { "discount.validUntil": { $exists: false } },
      ];
    }

    

    // Lean query with projection
    const books = await Book.find(query, {
      title: 1,
      slug: 1,
      coverImage: 1,
      author: 1,
      mpc: 1,
      discount: 1,
      quantity: 1,
      description: 1,
      publicationYear: 1,
      subCategory: 1,
      language: 1,
      pages: 1,
      publisher: 1,
      language: 1,
      quantity: 1,
      isNew: 1,
    })
      .collation({ locale: "bs", strength: 1 })
      .sort(sortQuery)
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean(); // ← lightweight plain JS objects

    const totalBooks = await Book.countDocuments(query);

    // Map prices and online quantity (no .toObject() needed)
    const booksWithPrices = books.map((book) => {
      const { mpc, discountedPrice, discountAmount } = calculatePrice(book.mpc, book.discount);
      const onlineQuantity = getOnlineAvailableQuantity(book.quantity);

      return {
        ...book,
        mpc,
        discountedPrice,
        discountAmount,
        onlineQuantity,
        isAvailableOnline: onlineQuantity > 0,
      };
    });

    res.json({
      books: booksWithPrices,
      totalBooks,
      totalPages: Math.ceil(totalBooks / limit),
      currentPage: Number(page),
    });
  } catch (err) {
    next(err);
  }
});

// GET slugged book
router.get("/slug/:slug", async (req, res) => {
  
  try {
    const book = await Book.findOne({ slug: req.params.slug });
    if (!book) {
    console.log("Book not found");
      return res.status(404).json({ message: "Book not found" });
    }

    const { mpc, discountedPrice, discountAmount } = calculatePrice(
      book.mpc || 0,
      book.discount || {},
    );

    const onlineQuantity = getOnlineAvailableQuantity(book.quantity);

    res.json({
      ...book.toObject(),
      mpc,
      discountedPrice,
      discountAmount,
      onlineQuantity,
      isAvailableOnline: onlineQuantity > 0,
    });
  } catch (err) {
    console.error("Error fetching book by slug:", err);
    res.status(500).json({ message: "Server error fetching book" });
  }
});

// GET related books - must come BEFORE /:id
router.get("/related/:id", async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid ID" });
  }

  try {
    const currentBook = await Book.findById(id);

    if (!currentBook) {
      return res.status(404).json({ message: "Book not found" });
    }

    const limit = 7;

    // 1️⃣ ISTI AUTOR
    const sameAuthor = await Book.aggregate([
      {
        $match: {
          author: currentBook.author,
          _id: { $ne: currentBook._id },
        },
      },
      { $sample: { size: limit } },
    ]);

    // 2️⃣ ISTA SUBCATEGORY (ako nema dovoljno)
    const remainingAfterAuthor = limit - sameAuthor.length;

    let sameSubCategory = [];
    if (remainingAfterAuthor > 0) {
      sameSubCategory = await Book.aggregate([
        {
          $match: {
            subCategory: currentBook.subCategory,
            _id: {
              $ne: currentBook._id,
              $nin: sameAuthor.map((b) => b._id),
            },
          },
        },
        { $sample: { size: remainingAfterAuthor } },
      ]);
    }

    const remainingAfterSub =
      remainingAfterAuthor - sameSubCategory.length;

    // 3️⃣ ISTA MAIN CATEGORY
    let sameMainCategory = [];
    if (remainingAfterSub > 0) {
      sameMainCategory = await Book.aggregate([
        {
          $match: {
            mainCategory: currentBook.mainCategory,
            _id: {
              $ne: currentBook._id,
              $nin: [
                ...sameAuthor.map((b) => b._id),
                ...sameSubCategory.map((b) => b._id),
              ],
            },
          },
        },
        { $sample: { size: remainingAfterSub } },
      ]);
    }

    const remainingAfterMain =
      remainingAfterSub - sameMainCategory.length;

    // 4️⃣ RANDOM FALLBACK
    let randomBooks = [];
    if (remainingAfterMain > 0) {
      randomBooks = await Book.aggregate([
        {
          $match: {
            _id: {
              $ne: currentBook._id,
              $nin: [
                ...sameAuthor.map((b) => b._id),
                ...sameSubCategory.map((b) => b._id),
                ...sameMainCategory.map((b) => b._id),
              ],
            },
          },
        },
        { $sample: { size: remainingAfterMain } },
      ]);
    }

    const relatedBooks = [
      ...sameAuthor,
      ...sameSubCategory,
      ...sameMainCategory,
      ...randomBooks,
    ];

    // 🔥 Dodaj price + onlineQuantity kao što već radiš
    const booksWithPrices = relatedBooks.map((book) => {
      const onlineQuantity = getOnlineAvailableQuantity(book.quantity);

      return {
        ...book,
        ...calculatePrice(book.mpc, book.discount),
        onlineQuantity,
        isAvailableOnline: onlineQuantity > 0,
      };
    });

    res.json(booksWithPrices);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch related books" });
  }
});

// SEARCH Books
router.get("/search", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);

    const results = await Book.aggregate([
      {
        $search: {
          index: "Bookstoredefault",
          compound: {
            should: [
              {
                autocomplete: {
                  query: q,
                  path: "title",
                  fuzzy: { maxEdits: 1 },
                },
              },
              {
                autocomplete: {
                  query: q,
                  path: "author",
                  fuzzy: { maxEdits: 1 },
                },
              },
            ],
            minimumShouldMatch: 1,
          },
        },
      },
      { $limit: 6 },
      {
        $project: {
  title: 1,
  author: 1,
  coverImage: 1,
  description: 1,
  mpc: 1,
  discount: 1,
  slug: 1,
  publicationYear: 1,
  subCategory: 1,
  language: 1,
  pages: 1,
  publisher: 1,
  quantity: 1,
},
      },
    ]);

    const resultsWithPrices = results.map((book) => {
  const onlineQuantity = getOnlineAvailableQuantity(book.quantity);

  return {
    ...book,
    ...calculatePrice(book.mpc, book.discount),
    onlineQuantity,
    isAvailableOnline: onlineQuantity > 0,
  };
});

    res.json(resultsWithPrices);
  } catch (err) {
    res.status(500).json({ error: "Search failed" });
  }
});

router.get("/redirect/:id", async (req, res) => {
  try {
    const book = await Book.findById(req.params.id).select("slug");
    if (!book) return res.status(404).json({ message: "Book not found" });

    // send JSON instead of HTTP redirect
    res.json({ url: `/books/${book.slug}` }); // frontend will redirect
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/// GET one book by ID (admin/internal)
router.get("/id/:id", async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ message: "Book not found" });

    const prices = calculatePrice(book.mpc, book.discount);

   const onlineQuantity = getOnlineAvailableQuantity(book.quantity);

res.json({
  ...book.toObject(),
  ...prices,
  onlineQuantity,
  isAvailableOnline: onlineQuantity > 0,
});

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// CREATE a new book

router.post("/", async (req, res) => {
  try {
    const slug = await slugifyUnique(req.body.title);

    const book = new Book({
      ...req.body,
      slug,
    });

    const newBook = await book.save();
    res.status(201).json(newBook);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// UPDATE a book by ID
router.patch("/:id", getBook, async (req, res) => {
  try {
    if (req.body.title) {
      req.body.slug = slugify(req.body.title);
    }

    Object.assign(res.book, req.body);
    const updatedBook = await res.book.save();

    res.json(updatedBook);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE a book by ID
router.delete("/:id", getBook, async (req, res) => {
  try {
    await res.book.remove();
    res.json({ message: "Deleted book" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Middleware to fetch book by ID
async function getBook(req, res, next) {
  let book;
  try {
    book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ message: "Book not found" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
  res.book = book;
  next();
}

module.exports = router;
