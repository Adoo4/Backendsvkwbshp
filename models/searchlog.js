// models/SearchLog.js
import mongoose from "mongoose";

const searchLogSchema = new mongoose.Schema({
  query: { type: String, required: true, lowercase: true, trim: true },
  count: { type: Number, default: 1 },
  lastSearched: { type: Date, default: Date.now },
});

searchLogSchema.index({ query: 1 }, { unique: true });
searchLogSchema.index({ count: -1 });

export default mongoose.models.SearchLog || mongoose.model("SearchLog", searchLogSchema);