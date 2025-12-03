const Agenda = require("agenda");
require("dotenv").config();
const formData = require("form-data");
const Mailgun = require("mailgun.js");

// Mailgun API client
const mailgun = new Mailgun(formData);
const mg = mailgun.client({
  username: "api",
  key: process.env.MAILGUN_API_KEY, // IMPORTANT: private API key
  url: "https://api.eu.mailgun.net" // EU region
});

const mongoConnectionString = process.env.MONGO_URI;

const agenda = new Agenda({
  db: { address: mongoConnectionString, collection: "agendaJobs" },
  processEvery: "5 seconds",
});

agenda.define("send order emails", async (job) => {
  console.log("🔔 Job started: send order emails");

  const { tempOrder } = job.attrs.data;
  if (!tempOrder) {
    console.warn("⚠️ No tempOrder passed to email job");
    return;
  }

  // Build item list text
const itemsList = tempOrder.items
  .map(item => {
    const bookName = item.book?.title || `Book ID: ${item.book._id}`;
    const author = item.book?.author ? ` by ${item.book.author}` : "";
    const price = item.priceAtPurchase || item.book.price;
    return `• ${bookName}${author} - ${item.quantity} x ${price} BAM`;
  })
  .join("\n");


  // Customer email data
  const customerMail = {
    from: process.env.MAIL_FROM,
    to: tempOrder.shipping.email,
    subject: `Vaša narudžba #${tempOrder.paymentId} je uspješno plaćena`,
    text: `
Poštovani ${tempOrder.shipping.fullName},

Hvala vam na kupovini! 🎉
Vaša narudžba je uspješno plaćena.

──────────────────────────────
🧾 PODACI O NARUDŽBI
──────────────────────────────
Broj narudžbe: ${tempOrder.paymentId}

${itemsList}

Ukupno za naplatu: ${tempOrder.totalAmount} BAM

──────────────────────────────
📦 DOSTAVA I PLAĆANJE
──────────────────────────────
Način plaćanja: ${tempOrder.paymentMethod}
Način dostave: ${tempOrder.shipping.deliveryMethod}

Adresa dostave:
${tempOrder.shipping.fullName}
${tempOrder.shipping.address}
${tempOrder.shipping.city}, ${tempOrder.shipping.zip}

──────────────────────────────
Još jednom, hvala na ukazanom povjerenju.
Srdačan pozdrav,
Svjetlostkomerc Bookstore
`
  };

  // Admin email data
  const adminMail = {
    from: process.env.MAIL_FROM,
    to: process.env.ADMIN_EMAIL,
    subject: `Nova plaćena narudžba #${tempOrder.paymentId}`,
    text: `Kupac: ${tempOrder.shipping.fullName}\nEmail: ${tempOrder.shipping.email}\nTelefon: ${tempOrder.shipping.phone}\n\nDetalji narudžbe:\n${itemsList}\n\nUkupno: ${tempOrder.totalAmount} BAM\nStatus: Plaćeno\nNačin plaćanja: ${tempOrder.paymentMethod}\nNačin dostave: ${tempOrder.shipping.deliveryMethod}\nAdresa dostave: ${tempOrder.shipping.address}, ${tempOrder.shipping.city}, ${tempOrder.shipping.zip}`,
  };

  console.log("📧 Sending emails through Mailgun HTTP API...");

  try {
    // Send customer email
    await mg.messages.create(process.env.MAILGUN_DOMAIN, customerMail);
    console.log(`✅ Customer email sent to ${customerMail.to}`);

    // Send admin email
    await mg.messages.create(process.env.MAILGUN_DOMAIN, adminMail);
    console.log(`✅ Admin email sent to ${adminMail.to}`);

    console.log("🎉 Job completed successfully!");
  } catch (err) {
    console.error("❌ Error sending emails:", err);
    throw err;
  }
});

// Start agenda
(async function () {
  console.log("🚀 Starting agenda...");
  await agenda.start();
  console.log("✅ Agenda started, waiting for jobs...");
})();

module.exports = agenda;
