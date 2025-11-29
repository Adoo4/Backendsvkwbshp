const Agenda = require("agenda");
require("dotenv").config();

const mongoConnectionString = process.env.MONGO_URI;

const agenda = new Agenda({
  db: { address: mongoConnectionString, collection: "agendaJobs" },
  processEvery: "5 seconds", // check for jobs every 5 seconds
});

// Define the job
agenda.define("send order emails", async (job) => {
   console.log("🔔 Job started: send order emails");
  const { tempOrder } = job.attrs.data; // receive full order from callback

  if (!tempOrder) {
    console.warn("⚠️ No tempOrder passed to email job");
    return;
  }

  // Build email content dynamically
 // Build a list of items
const itemsList = tempOrder.items.map(item => {
  // If 'book' is populated with name, use item.book.name
  const bookName = item.book.name || `Book ID: ${item.book}`;
  return `${bookName} - ${item.quantity} x ${item.priceAtPurchase} BAM`;
}).join("\n");

const customerMail = {
  from: `"Svjetlostkomerc Webshop" <${process.env.MAIL_USER}>`,
  to: tempOrder.shipping.email,
  subject: `Vaša narudžba #${tempOrder.paymentId} je uspješno plaćena`,
  text: `Poštovani ${tempOrder.shipping.fullName},\n\nVaša narudžba je uspješno plaćena.\nBroj narudžbe: ${tempOrder.paymentId}\n\nDetalji narudžbe:\n${itemsList}\n\nUkupno: ${tempOrder.totalAmount} BAM\n\nNačin plaćanja: ${tempOrder.paymentMethod}\nNačin dostave: ${tempOrder.shipping.deliveryMethod}\n\nAdresa dostave:\n${tempOrder.shipping.address}, ${tempOrder.shipping.city}, ${tempOrder.shipping.zip}\n\nHvala na kupovini!`,
};

const adminMail = {
  from: `"Svjetlostkomerc Webshop" <${process.env.MAIL_USER}>`,
  to: process.env.ADMIN_EMAIL,
  subject: `Nova plaćena narudžba #${tempOrder.paymentId}`,
  text: `Kupac: ${tempOrder.shipping.fullName}\nEmail: ${tempOrder.shipping.email}\nTelefon: ${tempOrder.shipping.phone}\n\nDetalji narudžbe:\n${itemsList}\n\nUkupno: ${tempOrder.totalAmount} BAM\nStatus: Plaćeno\nNačin plaćanja: ${tempOrder.paymentMethod}\nNačin dostave: ${tempOrder.shipping.deliveryMethod}\nAdresa dostave: ${tempOrder.shipping.address}, ${tempOrder.shipping.city}, ${tempOrder.shipping.zip}`,
};

  console.log("📧 Preparing to send emails...");


  const nodemailer = require("nodemailer");
  const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: process.env.MAIL_PORT,
    secure: process.env.MAIL_SECURE === "true",
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });

  try {
     console.log(`✉️ Sending customer email to: ${customerMail.to}`);
    await transporter.sendMail(customerMail);
    console.log(`✅ Customer email sent to ${customerMail.to}`);

 console.log(`✉️ Sending admin email to: ${adminMail.to}`);
    await transporter.sendMail(adminMail);
    console.log(`✅ Admin email sent to ${adminMail.to}`);
     console.log("🎉 Job completed successfully!");
  } catch (err) {
    
    console.error("❌ Error sending emails:", err);
    throw err; // Agenda will retry if configured
  }
});

// Start agenda
(async function () {
  console.log("🚀 Starting agenda...");
  await agenda.start();
  console.log("✅ Agenda started, waiting for jobs...");
})();

module.exports = agenda;
