// utils/priceUtils.js

/**
 * Calculates final price including VAT and discount
 * @param {number} basePrice - net price of the book
 * @param {Object} discount - discount object { amount, validUntil }
 * @param {number} vatRate - VAT rate, default 17%
 * @param {Date} now - optional current date, default = new Date()
 * @returns {Object} - { priceWithVAT, discountedPrice, discountAmount }
 */
function calculatePrice(basePrice, discount = {}, vatRate = 0.17, now = new Date()) {
  // 1️⃣ Add VAT
  const priceWithVAT = Number((basePrice * (1 + vatRate)).toFixed(2));

  let discountAmount = 0;
  let discountedPrice = priceWithVAT;

  // 2️⃣ Apply discount if valid
  if (discount.amount && discount.validUntil) {
    const validUntil = new Date(discount.validUntil);
    if (validUntil >= now) {
      discountAmount = discount.amount;
      discountedPrice = Number((priceWithVAT * (1 - discountAmount / 100)).toFixed(2));
    }
  }

  return { priceWithVAT, discountedPrice, discountAmount };
}

module.exports = { calculatePrice };
