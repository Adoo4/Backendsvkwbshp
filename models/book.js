const mongoose = require("mongoose");

const categoryMap = {
  "Beletristika": [
    "Roman", "Ljubavni roman", "Istorijski roman", "Psihološki roman", "Triler / Krimi",
    "Naučna fantastika (Sci-Fi)", "Fantastika / Fantasy", "Domaći roman", "Strani roman",
    "Pripovijetke i novele", "Drama", "Poezija", "Klasici", "Humoristička književnost", "Mitologija"
  ],
  "Literatura za djecu i mlade": [
    "Bajke i basne", "Ilustrirane knjige", "Knjige za prve čitače",
    "Teen romani / Young Adult", "Edukativne knjige za djecu", "Stripovi i slikovnice"
  ],
  "Naučna i stručna literatura": [
    "Pravo", "Ekonomija i biznis", "Psihologija", "Medicina", "Tehnika i IT",
    "Prirodne nauke", "Društvene nauke", "Obrazovanje i pedagogija"
  ],
  "Publicistika": [
    "Biografije i autobiografije", "Eseji", "Putopisi", "Historija", "Filozofija",
    "Religija i duhovnost", "Politika i društvo"
  ],
  "Samopomoć i razvoj": [
    "Lični razvoj", "Motivacija i uspjeh", "Zdravlje i wellness", "Mindfulness i meditacija",
    "Ljubavni i partnerski odnosi", "Roditeljstvo i porodica"
  ],
  "Kuharice i gastronomija": [
    "Nacionalna kuhinja", "Zdrava ishrana", "Vegetarijanska / veganska kuhinja", "Slatkiši i peciva"
  ],
  "Hobiji i slobodno vrijeme": [
    "Uradi sam (DIY)", "Umjetnost i dizajn", "Moda i stil", "Baštovanstvo",
    "Sport i fitness", "Putovanja i vodiči"
  ],
};

const bookSchema = new mongoose.Schema(
  {
    title:              { type: String, required: true },
    slug:               { type: String },
    author:             { type: String, required: true },
    description:        { type: String, required: true },
    mainCategory: {
      type: String,
      enum: Object.keys(categoryMap),
      required: true,
    },
    subCategory: {
      type: String,
      required: true,
      validate: {
        validator: function (value) {
          return categoryMap[this.mainCategory]?.includes(value);
        },
        message: (props) =>
          `"${props.value}" is not a valid subcategory for the chosen main category`,
      },
    },
    language:           { type: String, required: true },
    price:              { type: Number, required: true },
    mpc:                { type: Number, default: 0, required: true },
    coverImage:         { type: String, required: true },
    publicationYear:    { type: Number },
    publisher:          { type: String, required: true },
    pages:              { type: Number, required: true },
    format:             { type: String, required: true },
    isbn:               { type: String, required: true },
    barcode:            { type: String, required: true },
    TR:                 { type: String, required: true },
    dimensions:         { type: String, required: true },
    supplierItemNumber: { type: String, required: true },
    discount: {
      amount:     { type: Number, min: 0, max: 100, default: 0 },
      validUntil: { type: Date, required: true },
    },
    isNew:    { type: Boolean, default: false, required: true },
    quantity: { type: Number, default: 1, min: 0, required: true },
  },
  { timestamps: true }
);

// ── Indexes ────────────────────────────────────────────────────────────────

// Unique slug for fast single-book lookups (/slug/:slug route)
bookSchema.index({ slug: 1 }, { unique: true, sparse: true });

// Author index — powers the related books query
bookSchema.index({ author: 1 });

// Category filtering
bookSchema.index({ mainCategory: 1, subCategory: 1 });
bookSchema.index({ mainCategory: 1, language: 1 });

// Sorting / filtering
bookSchema.index({ isNew: 1, updatedAt: -1 });
bookSchema.index({ mpc: 1 });
bookSchema.index({ "discount.amount": -1 });
bookSchema.index({ updatedAt: -1 });

// Discount filtering (amount + expiry checked together in the router)
bookSchema.index({ "discount.amount": 1, "discount.validUntil": 1 });

// Default relevance sort: quantity → isNew → discount → updatedAt → title
bookSchema.index({
  quantity: -1,
  isNew: -1,
  "discount.amount": -1,
  updatedAt: -1,
  title: 1,
});

// Full-text search (fallback — Atlas Search is preferred)
bookSchema.index({ title: "text", author: "text" });

module.exports = mongoose.model("Book", bookSchema);