const Agenda = require("agenda");
require("dotenv").config();
const formData = require("form-data");
const Mailgun = require("mailgun.js");
const TempOrder = require("../models/tempOrder");
const EmailTemplate = require("../utils/emailTemplate");
const fs = require("fs");

 
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
    bhposta: { label: "BH Pošta", price: 8 },
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
  const book = item.book;
  return `
    <div style="padding:6px 0; border-bottom:1px solid #eee;">
      <div style="font-weight:bold; color:#333;">
        ${book?.title || "Nepoznata knjiga"}
      </div>
      <div style="color:#666; font-size:13px;">
        ${book?.author ? `Autor: ${book.author}` : ""}
      </div>
      <div style="margin-top:3px; font-size:14px; color:#222;">
        ${item.quantity} × ${item.priceAtPurchase || book.price} KM
      </div>
    </div>
  `;
}).join("");


const itemsListAdmin = order.items.map(item => {
  const book = item.book;
  return `
    <div style="padding:8px 0; border-bottom:1px solid #eee;">
      <div style="font-weight:bold; color:#333; font-size:15px;">
        ${book?.title || "Nepoznata knjiga"}
      </div>

      <div style="color:#555; font-size:13px;">
        Autor: ${book?.author || "N/A"}
      </div>

      <div style="margin-top:4px; font-size:14px; color:#222;">
        ${item.quantity} × ${item.priceAtPurchase || book.price} KM
      </div>

      <div style="margin-top:10px; font-size:12px; color:#555; line-height:1.5;">
        <b>ISBN:</b> ${book?.isbn || "N/A"}<br>
        <b>Barcode:</b> ${book?.barcode || "N/A"}<br>
        <b>TR:</b> ${book?.TR || "N/A"}<br>
        <b>Izdavač:</b> ${book?.publisher || "N/A"}<br>
        <b>Jezik:</b> ${book?.language || "N/A"}<br>
        <b>Godina:</b> ${book?.publicationYear || "N/A"}<br>
        <b>Format:</b> ${book?.format || "N/A"}<br>
        <b>Broj stranica:</b> ${book?.pages || "N/A"}<br>
        <b>Kategorija:</b> ${book?.mainCategory || "N/A"}<br>
        <b>Potkategorija:</b> ${book?.subCategory || "N/A"}
      </div>
    </div>
  `;
}).join("");



  const deliveryText = formatDelivery(order.delivery.method);

 // -------- CUSTOMER EMAIL -------- //
const customerMail = {
  from: process.env.MAIL_FROM,
  to: order.shipping.email,
  subject: `Vaša narudžba #${order.paymentId} je uspješno plaćena`,
 html: EmailTemplate(order, itemsList, deliveryText, false),
  inline: [
  {
    filename: "maillogo.png",
    data: fs.readFileSync(__dirname + "/../assets/maillogo.png")
  }
]
};

// -------- ADMIN EMAIL -------- //
const adminMail = {
  from: process.env.MAIL_FROM,
  to: process.env.ADMIN_EMAIL,
  subject: `Nova plaćena narudžba #${order.paymentId}`,
  html: EmailTemplate(order, itemsListAdmin, deliveryText, true), // <-- USE ADMIN VERSION
  inline: [
    {
      filename: "maillogo.png",
      data: fs.readFileSync(__dirname + "/../assets/maillogo.png")
    }
  ]
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
