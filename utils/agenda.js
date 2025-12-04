const Agenda = require("agenda");
require("dotenv").config();
const formData = require("form-data");
const Mailgun = require("mailgun.js");
const TempOrder = require("../models/tempOrder"); // <-- REQUIRED for populate!!

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

// ============== EMAIL JOB ============== //
agenda.define("send order emails", async (job) => {
  console.log("🔔 Job started: send order emails");

  const { tempOrder } = job.attrs.data;
  if (!tempOrder?.paymentId) {
    return console.warn("⚠️ tempOrder missing paymentId in job");
  }

  // 🔥 Fetch clean instance with populate (this fixes your issue)
  const order = await TempOrder.findOne({ paymentId: tempOrder.paymentId })
    .populate("items.book");

  if (!order) {
    return console.warn("⚠️ Order not found when job was executed");
  }

  console.log("📦 Order loaded & populated for email sending");

  // -------- ITEM LIST -------- //
  const itemsList = order.items.map(item => {
    const name = item.book?.title || `Book ID: ${item.book}`;
    const author = item.book?.author ? ` by ${item.book.author}` : "";
    const price = item.priceAtPurchase || item.book.price;

    return `• ${name}${author} — ${item.quantity} x ${price} BAM`;
  }).join("\n");

  // -------- CUSTOMER EMAIL -------- //
  const customerMail = {
    from: process.env.MAIL_FROM,
    to: order.shipping.email,
    subject: `Vaša narudžba #${order.paymentId} je uspješno plaćena`,
    text: `
Poštovani ${order.shipping.fullName},

Hvala vam na kupovini! 🎉
Vaša narudžba je uspješno plaćena.

──────────────────────────────
🧾 PODACI O NARUDŽBI
──────────────────────────────
Broj narudžbe: ${order.paymentId}

${itemsList}

Ukupno: ${order.totalAmount} BAM

──────────────────────────────
📦 DOSTAVA I PLAĆANJE
──────────────────────────────
Plaćanje: ${order.paymentMethod}
Dostava: ${order.shipping.deliveryMethod}

Adresa dostave:
${order.shipping.fullName}
${order.shipping.address}
${order.shipping.city}, ${order.shipping.zip}

──────────────────────────────
Još jednom hvala na povjerenju.
Svjetlostkomerc Bookstore
`
  };

  // -------- ADMIN EMAIL -------- //
  const adminMail = {
    from: process.env.MAIL_FROM,
    to: process.env.ADMIN_EMAIL,
    subject: `Nova plaćena narudžba #${order.paymentId}`,
    text:
`Kupac: ${order.shipping.fullName}
Email: ${order.shipping.email}
Telefon: ${order.shipping.phone}

Narudžba:
${itemsList}

Total: ${order.totalAmount} BAM
Plaćanje: ${order.paymentMethod}
Dostava: ${order.shipping.deliveryMethod}
Adresa: ${order.shipping.address}, ${order.shipping.city}, ${order.shipping.zip}`
  };

  // -------- SEND EMAILS -------- //
  try {
    await mg.messages.create(process.env.MAILGUN_DOMAIN, customerMail);
    console.log("📨 Customer email sent");

    await mg.messages.create(process.env.MAILGUN_DOMAIN, adminMail);
    console.log("📨 Admin email sent");

    console.log("🎉 All emails delivered");
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
