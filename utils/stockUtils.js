const RESERVED_STORE_QTY = 1;

function getOnlineAvailableQuantity(quantity) {
  return Math.max(quantity - RESERVED_STORE_QTY, 0);
}

function canBeSoldOnline(quantity, requestedQty = 1) {
  return getOnlineAvailableQuantity(quantity) >= requestedQty;
}

module.exports = {
  RESERVED_STORE_QTY,
  getOnlineAvailableQuantity,
  canBeSoldOnline,
};
