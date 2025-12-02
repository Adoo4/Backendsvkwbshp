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
      const bookName = item.book.name || `Book ID: ${item.book}`;
      return `${bookName} - ${item.quantity} x ${item.priceAtPurchase} BAM`;
    })
    .join("\n");

  // Customer email data
  const customerMail = {
    from: `"Svjetlostkomerc Webshop" <${process.env.MAIL_USER}>`,
    to: tempOrder.shipping.email,
    subject: `Vaša narudžba #${tempOrder.paymentId} je uspješno plaćena`,
    text: `Poštovani ${tempOrder.shipping.fullName},\n\nVaša narudžba je uspješno plaćena.\nBroj narudžbe: ${tempOrder.paymentId}\n\nDetalji narudžbe:\n${itemsList}\n\nUkupno: ${tempOrder.totalAmount} BAM\n\nNačin plaćanja: ${tempOrder.paymentMethod}\nNačin dostave: ${tempOrder.shipping.deliveryMethod}\n\nAdresa dostave:\n${tempOrder.shipping.address}, ${tempOrder.shipping.city}, ${tempOrder.shipping.zip}\n\nHvala na kupovini!`,
  };

  // Admin email data
  const adminMail = {
    from: `"Svjetlostkomerc Webshop" <${process.env.MAIL_USER}>`,
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
