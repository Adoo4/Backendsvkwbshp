const express = require("express");
const router = express.Router();
const Book = require("../models/book");

router.get("/", async (req, res) => {
  try {
    const {
      page = 0,
      pageSize = 10,
      sortField = "_id",
      sortOrder = "asc",
      filters = "{}",
    } = req.query;

    const parsedFilters = JSON.parse(filters);

    const query = {};

    // Example filters
    if (parsedFilters.mainCategory) {
      query.mainCategory = parsedFilters.mainCategory;
    }

    if (parsedFilters.isNew) {
      query.isNew = true;
    }

    const sort = {
      [sortField]: sortOrder === "asc" ? 1 : -1,
    };

    const rows = await Book.find(query)
      .sort(sort)
      .skip(page * pageSize)
      .limit(Number(pageSize));

    const total = await Book.countDocuments(query);

    res.json({ rows, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load books" });
  }
});

module.exports = router;
