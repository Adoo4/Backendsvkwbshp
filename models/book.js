const mongoose = require("mongoose");

// Mapping of main categories to their subcategories
const categoryMap = {
  "Beletristika": [
    "Roman",
    "Ljubavni roman",
    "Istorijski roman",
    "Psihološki roman",
    "Triler / Krimi",
    "Naučna fantastika (Sci-Fi)",
    "Fantastika / Fantasy",
    "Domaći roman",
    "Strani roman",
    "Pripovijetke i novele",
    "Drama",
    "Poezija",
    "Klasici",
    "Humoristička književnost"
  ],
  "Literatura za djecu i mlade": [
    "Bajke i basne",
    "Ilustrirane knjige",
    "Knjige za prve čitače",
    "Teen romani / Young Adult",
    "Edukativne knjige za djecu",
    "Stripovi i slikovnice"
  ],
  "Naučna i stručna literatura": [
    "Pravo",
    "Ekonomija i biznis",
    "Psihologija",
    "Medicina",
    "Tehnika i IT",
    "Prirodne nauke",
    "Društvene nauke",
    "Obrazovanje i pedagogija"
  ],
  "Publicistika": [
    "Biografije i autobiografije",
    "Eseji",
    "Putopisi",
    "Istorija",
    "Filozofija",
    "Religija i duhovnost",
    "Politika i društvo"
  ],
  "Samopomoć i razvoj": [
    "Lični razvoj",
    "Motivacija i uspjeh",
    "Zdravlje i wellness",
    "Mindfulness i meditacija",
    "Ljubavni i partnerski odnosi",
    "Roditeljstvo i porodica"
  ],
  "Kuharice i gastronomija": [
    "Nacionalna kuhinja",
    "Zdrava ishrana",
    "Vegetarijanska / veganska kuhinja",
    "Slatkiši i peciva"
  ],
  "Hobiji i slobodno vrijeme": [
    "Uradi sam (DIY)",
    "Umjetnost i dizajn",
    "Moda i stil",
    "Baštovanstvo",
    "Sport i fitness",
    "Putovanja i vodiči"
  ]
};

const bookSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    author: String,
    description: String,

    mainCategory: {
      type: String,
      enum: Object.keys(categoryMap),
      required: true
    },

    subCategory: {
      type: String,
      required: true,
      validate: {
        validator: function (value) {
          // Make sure subCategory belongs to the chosen mainCategory
          return categoryMap[this.mainCategory]?.includes(value);
        },
        message: props => `"${props.value}" is not a valid subcategory for the chosen main category`
      }
    },

    language: String,
    price: { type: Number, required: true },
    coverImage: String,
    publicationYear: Number,
    publisher: String,
    pages: Number,
    format: String,
    isbn: String,

    discount: {
      amount: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
      },
      validUntil: Date
    },

    isNew: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Book", bookSchema);
