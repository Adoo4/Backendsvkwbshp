// utils/cartCalculator.js
function calculateDiscountedPrice(book) {
  const now = new Date();
  if (book.discount?.amount && book.discount?.validUntil) {
    const validUntil = new Date(book.discount.validUntil);
    if (validUntil >= now) {
      return book.price * (1 - book.discount.amount / 100);
    }
  }
  return book.price;
}

function calculateCartTotals(items, deliveryMethod = null) {
  let totalCart = 0;

  const detailedItems = items.map((item) => {
    const book = item.book;
    if (!book) return null;

    const discountedPrice = calculateDiscountedPrice(book);
    const itemTotal = discountedPrice * item.quantity;
    totalCart += itemTotal;

    return {
      _id: item._id,
      quantity: item.quantity,
      itemTotal,
      book: {
        _id: book._id,
        title: book.title,
        author: book.author,
        price: book.price,
        discountedPrice,
        discount: {
          amount: book.discount?.amount || 0,
          validUntil: book.discount?.validUntil || null,
        },
        coverImage: book.coverImage,
        format: book.format,
        isbn: book.isbn,
        pages: book.pages,
      },
    };
  }).filter(Boolean);

  // Delivery
  let delivery = 0;
  if (deliveryMethod) {
    switch (deliveryMethod) {
      case "bhposta":
        delivery = 4.5;
        break;
      case "euroexpress":
        delivery = 10;
        break;
      case "storepickup":
        delivery = 0;
        break;
      default:
        delivery = 0;
    }
  } else {
    // fallback: free delivery if totalCart >= 100
    delivery = totalCart >= 100 ? 0 : 5;
  }

  const totalWithDelivery = totalCart + delivery;

  return { detailedItems, totalCart, delivery, totalWithDelivery };
}

module.exports = { calculateDiscountedPrice, calculateCartTotals };
