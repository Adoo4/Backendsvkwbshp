const Agenda = require("agenda");
require("dotenv").config();
const formData = require("form-data");
const Mailgun = require("mailgun.js");
const TempOrder = require("../models/tempOrder");
const EmailTemplate = require("../utils/emailTemplate");

// ---------------- MAILGUN CLIENT ---------------- //
const mailgun = new Mailgun(formData);
const mg = mailgun.client({
  username: "api",
  key: process.env.MAILGUN_API_KEY,
  url: "https://api.eu.mailgun.net"
});

// ---------------- AGENDA CONFIG ---------------- //
const agenda = new Agenda({
  db: { address: process.env.MONGO_URI, collection: "agendaJobs" },
  processEvery: "5 seconds",
});

// Helper – delivery text + price
function formatDelivery(method) {
  const map = {
    bhposta: { label: "BH Pošta", price: 4.5 },
    brzapošta: { label: "Brza Pošta", price: 10 },
    storepickup: { label: "Preuzimanje u radnji", price: 0 },
  };

  const data = map[method?.toLowerCase()];
  if (!data) return method;

  return `${data.label} (${data.price} KM)`;
}


// ============== EMAIL JOB ============== //
agenda.define("send order emails", async (job) => {
  console.log("🔔 Job started: send order emails");

  const { tempOrder } = job.attrs.data;
  if (!tempOrder?.paymentId) {
    return console.warn("⚠️ tempOrder missing paymentId in job");
  }

  const order = await TempOrder.findOne({ paymentId: tempOrder.paymentId })
    .populate("items.book");

  if (!order) {
    return console.warn("⚠️ Order not found when job was executed");
  }

  console.log("📦 Order loaded & populated for email sending");

  // -------- ITEM LIST WITH BOOKS -------- //
  const itemsList = order.items.map(item => {
    const name = item.book?.title || `Book ID: ${item.book}`;
    const author = item.book?.author ? ` od autora ${item.book.author}` : "";
    const price = item.priceAtPurchase || item.book.price;

    return `• ${name}${author} — ${item.quantity} x ${price} BAM`;
  }).join("\n");

  const deliveryText = formatDelivery(order.shipping.deliveryMethod);

 // -------- CUSTOMER EMAIL -------- //
const customerMail = {
  from: process.env.MAIL_FROM,
  to: order.shipping.email,
  subject: `Vaša narudžba #${order.paymentId} je uspješno plaćena`,
  html: EmailTemplate(order, itemsList, deliveryText),
  text: `Vaša narudžba #${order.paymentId} je uspješno plaćena.\nDetalji:\n${itemsList}\nDostava: ${deliveryText}`,
  inline: ["./assets/logo.png"], // <-- attach logo
};

// -------- ADMIN EMAIL -------- //
const adminMail = {
  from: process.env.MAIL_FROM,
  to: process.env.ADMIN_EMAIL,
  subject: `Nova plaćena narudžba #${order.paymentId}`,
  html: EmailTemplate(order, itemsList, deliveryText),
  text: `Nova narudžba #${order.paymentId}.\nKupac: ${order.shipping.fullName}\nStavke:\n${itemsList}\nDostava: ${deliveryText}`,
  inline: ["./assets/logo.png"], // <-- attach logo
};

  try {
    await mg.messages.create(process.env.MAILGUN_DOMAIN, customerMail);
    console.log("📨 Customer email sent");

    await mg.messages.create(process.env.MAILGUN_DOMAIN, adminMail);
    console.log("📨 Admin email sent");

    console.log("🎉 All emails delivered successfully");
  } catch (e) {
    console.error("❌ Mailgun send ERROR:", e);
  }
});

// ---------------- START AGENDA ---------------- //
(async function () {
  console.log("🚀 Agenda starting...");
  await agenda.start();
  console.log("🟢 Agenda running and waiting for jobs...");
})();

module.exports = agenda;
