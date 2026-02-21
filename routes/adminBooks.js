const express = require("express");
const router = express.Router();
const Book = require("../models/book");

router.get("/", async (req, res) => {
  try {
    // 1️⃣ Pagination
    const page = Number(req.query.page) || 0; // 0-based
    const pageSize = Number(req.query.pageSize) || 10;

    // 2️⃣ Sorting
    const sortField = req.query.sortField || "_id";
    const sortOrder = req.query.sortOrder === "desc" ? -1 : 1;

    // 3️⃣ Map DataGrid fields → MongoDB fields
    const sortFieldMap = {
      discountAmount: "discount.amount",
      discountValidUntil: "discount.validUntil",
    };

    const mongoSortField = sortFieldMap[sortField] || sortField;

    // 4️⃣ Filters
    const filters = JSON.parse(req.query.filters || "{}");
    const query = {};

    
    if (filters.mainCategory) query.mainCategory = filters.mainCategory;
    if (filters.isNew) query.isNew = true;

    // 5️⃣ MongoDB query (SORT HAPPENS HERE)
    const rows = await Book.find(query)
      .sort({ [mongoSortField]: sortOrder })
      .skip(page * pageSize)
      .limit(pageSize)
      .lean();

    // 6️⃣ Normalize + flatten discount fields
    const rowsWithDiscount = rows.map(row => ({
      ...row,
      discount: row.discount || { amount: 0, validUntil: null },
      discountAmount: row.discount?.amount ?? 0,
      discountValidUntilDate: row.discount?.validUntil,
    }));

    // 7️⃣ Total count
    const total = await Book.countDocuments(query);

    // 8️⃣ Response
    res.json({ rows: rowsWithDiscount, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load books" });
  }
});

module.exports = router;
