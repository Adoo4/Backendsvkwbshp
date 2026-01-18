const mongoose = require("mongoose");

// Mapping of main categories to their subcategories
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
  ]
};

const bookSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    author: { type: String, required: true },
    description: { type: String, required: true },
    mainCategory: { type: String, enum: Object.keys(categoryMap), required: true },
    subCategory: {
      type: String,
      required: true,
      validate: {
        validator: function (value) {
          return categoryMap[this.mainCategory]?.includes(value);
        },
        message: props => `"${props.value}" is not a valid subcategory for the chosen main category`
      }
    },
    language: { type: String, required: true },
    price: { type: Number, required: true },
    coverImage: { type: String, required: true },
    publicationYear: { type: Number },
    publisher: { type: String, required: true },
    pages: { type: Number, required: true },
    format: { type: String, required: true },
    isbn: { type: String, required: true },
    barcode: { type: String, required: true },
    TR: { type: String, required: true },
    dimensions: { type: String, required: true },
    supplierItemNumber: { type: String, required: true },
    discount: {
      amount: { type: Number, min: 0, max: 100, default: 0 }, // allows decimals
      validUntil: { type: Date, required: true }
    },
    isNew: { type: Boolean, default: false, required: true },
    quantity: { type: Number, default: 1, min: 0, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Book", bookSchema);
