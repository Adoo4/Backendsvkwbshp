const express = require("express");
const router = express.Router();
const Book = require("../models/book");
const { calculatePrice } = require("../utils/priceUtils");

// GET all books
{/*router.get("/", async (req, res) => {
  try {
    const books = await Book.find();
    res.json(books);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
*/}


{/* New GET all books*/}
router.get("/", async (req, res, next) => {
  try {
     res.set("Cache-Control", "no-store"); // upitno, provjeravati
    const {
      page = 1,
      limit = 20,
      mainCategory,   
      subCategory,
      language,
      isNew,
      discount,
    } = req.query;

    const query = {};

    if (mainCategory && mainCategory.toLowerCase() !== "sve knjige") {
      query.mainCategory = mainCategory;
    }
    if (subCategory) query.subCategory = subCategory;
    if (language) query.language = language;
    if (isNew === "true" || isNew === true) query.isNew = true;
     // ✅ Filter only valid discounts
       // ✅ Filter only books with valid, non-expired discounts
    if (discount === "true" || discount === true) {
  const today = new Date();
  query["discount.amount"] = { $gt: 0 };
  query["$or"] = [
    { "discount.validUntil": { $gte: today } },
    { "discount.validUntil": { $exists: false } }, // includes books with no validUntil
  ];
} //novo
    console.log("MongoDB query:", JSON.stringify(query, null, 2));

    const books = await Book.find(query)
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const totalBooks = await Book.countDocuments(query);

    const booksWithPrices = books.map((book) => {
  const { priceWithVAT, discountedPrice, discountAmount } = calculatePrice(book.price, book.discount);
  return {
    ...book.toObject(),
    priceWithVAT,
    discountedPrice,
    discountAmount,
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







// GET related books - must come BEFORE /:id
router.get("/related/:id", async (req, res) => {
  const { id } = req.params;
  const { category } = req.query;

  if (!category) return res.status(400).json({ message: "Category is required" });

 try {
  const books = await Book.aggregate([
    { $match: { mainCategory: category, _id: { $ne: id } } }, // exclude current book
    { $sample: { size: 7 } }, // randomly select 10 books
    { $project: { _id: 1, title: 1, coverImage: 1, author: 1 } } // select fields
  ]);

  res.status(200).json(books);
} catch (err) {
  console.error(err);
  res.status(500).json({ error: "Failed to fetch related books" });
}

});router.get("/related/:id", async (req, res) => {
  const { id } = req.params;
  const { category } = req.query;

  if (!category) {
    return res.status(400).json({ message: "Category is required" });
  }

  try {
    const books = await Book.aggregate([
      { $match: { mainCategory: category, _id: { $ne: id } } },
      { $sample: { size: 7 } },
      {
        $project: {
          title: 1,
          coverImage: 1,
          author: 1,
          price: 1,
          discount: 1,
        },
      },
    ]);

    const booksWithPrices = books.map((book) => ({
      ...book,
      ...calculatePrice(book.price, book.discount),
    }));

    res.json(booksWithPrices);
  } catch (err) {
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
              { autocomplete: { query: q, path: "title", fuzzy: { maxEdits: 1 } } },
              { autocomplete: { query: q, path: "author", fuzzy: { maxEdits: 1 } } },
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
          price: 1,
          discount: 1,
        },
      },
    ]);

    const resultsWithPrices = results.map((book) => ({
      ...book,
      ...calculatePrice(book.price, book.discount),
    }));

    res.json(resultsWithPrices);
  } catch (err) {
    res.status(500).json({ error: "Search failed" });
  }
});



// GET one book by ID
router.get("/:id", async (req, res) => {
  const book = await Book.findById(req.params.id);
  if (!book) return res.status(404).json({ message: "Book not found" });

  const prices = calculatePrice(book.price, book.discount);

  res.json({
    ...book.toObject(),
    ...prices,
  });
});




// CREATE a new book
router.post("/", async (req, res) => {
  const book = new Book(req.body);
  try {
    const newBook = await book.save();
    res.status(201).json(newBook);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// UPDATE a book by ID
router.patch("/:id", getBook, async (req, res) => {
  Object.assign(res.book, req.body);
  try {
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
