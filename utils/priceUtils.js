/**
 * Calculates discounted price based on mpc (already includes VAT)
 * @param {number} basePrice - mpc from DB
 * @param {Object} discount - { amount, validUntil }
 * @param {Date} now - optional, defaults to new Date()
 * @returns {Object} - { mpc, discountedPrice, discountAmount }
 */
function calculatePrice(basePrice, discount = {}, now = new Date()) {
  const mpc = Number(basePrice ?? 0); // fallback to 0 if null/undefined

  let discountAmount = 0;
  let discountedPrice = mpc;

  if (discount?.amount && discount?.validUntil) {
    const validUntil = new Date(discount.validUntil);
    if (validUntil >= now) {
      discountAmount = discount.amount;
      discountedPrice = Number((mpc * (1 - discountAmount / 100)).toFixed(2));
    }
  }

  return { mpc, discountedPrice, discountAmount };
}

module.exports = { calculatePrice };
