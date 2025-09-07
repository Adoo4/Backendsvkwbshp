const express = require("express");
const router = express.Router();
const Book = require("../models/book");

// GET all books
router.get("/", async (req, res) => {
  try {
    const books = await Book.find();
    res.json(books);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET related books - must come BEFORE /:id
router.get("/related/:id", async (req, res) => {
  const { id } = req.params;
  const { category } = req.query;

  if (!category) return res.status(400).json({ message: "Category is required" });

  try {
    const books = await Book.find({
      mainCategory: category,
      _id: { $ne: id } // exclude current book
    })
      .limit(4) // optional: limit number of suggestions
      .select("_id title coverImage author");

    res.status(200).json(books);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching related books" });
  }
});

// GET one book by ID
router.get("/:id", async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ message: "Book not found" });
    res.json(book);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
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
