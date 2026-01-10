const express = require("express");
const router = express.Router();
const Book = require("../models/book");

router.get("/", async (req, res) => {
  try {
    const pageNum = Number(req.query.page ?? 0);
    const pageSizeNum = Number(req.query.pageSize ?? 10);
    const sortField = req.query.sortField || "_id";
    const sortOrder = req.query.sortOrder === "desc" ? -1 : 1;
    const filters = JSON.parse(req.query.filters || "{}");

    const query = {};
    if (filters.mainCategory) query.mainCategory = filters.mainCategory;
    if (filters.isNew) query.isNew = true;

    const rows = await Book.find(query)
      .sort({ [sortField]: sortOrder })
      .skip(pageNum * pageSizeNum)
      .limit(pageSizeNum);

    const total = await Book.countDocuments(query);

    res.json({ rows, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load books" });
  }
});
module.exports = router;
