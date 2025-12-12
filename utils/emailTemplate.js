function EmailTemplate(order, itemsList, deliveryText) {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif; background:#f7f7f7; padding:30px;">
    <div style="max-width:600px; background:white; margin:auto; border-radius:8px; overflow:hidden; border:1px solid #ddd;">
      
      <!-- HEADER WITH LOGO -->
      <div style="background:#222; color:white; padding:18px; font-size:20px; text-align:center;">
       <img src="cid:maillogo.png" alt="Bookstore Logo" style="max-width:180px; margin-bottom:8px;"/>
      </div>

      <div style="padding:25px;">
        <h2 style="margin-top:0; color:#333;">Hvala na kupovini, ${order.shipping.fullName}! 🎉</h2>
        <p style="color:#555; font-size:15px;">
          Vaša narudžba je uspješno zabilježena i obrađena.
        </p>

        <hr style="border:none; border-top:1px solid #eee; margin:20px 0;"/>

      <h3 style="color:#333;">🧾 Detalji narudžbe</h3>

<div style="margin-top:10px; margin-bottom:20px;">
  ${itemsList}
</div>


        <p style="font-size:16px; margin-top:20px;">
          <b>Ukupno:</b> <span style="color:#111;">${order.totalAmount} KM</span>
        </p>

        <p style="font-size:14px; color:#444;">
          <b>Dostava:</b> ${deliveryText}<br>
          <i style="color:#777;">(Trošak dostave je uključen u ukupnu cijenu)</i>
        </p>

        <hr style="border:none; border-top:1px solid #eee; margin:20px 0;"/>

        <h3 style="color:#333;">📦 Podaci za dostavu</h3>
        <p style="font-size:14px; color:#444;">
          ${order.shipping.fullName}<br>
          ${order.shipping.address}<br>
          ${order.shipping.city}, ${order.shipping.zip}<br>
          Email: ${order.shipping.email}<br>
          Telefon: ${order.shipping.phone}
        </p>

        <div style="margin-top:30px; font-size:13px; color:#666;">
          Hvala na povjerenju!<br>
          <b>Svjetlostkomerc Bookstore</b>
        </div>
      </div>
    </div>
  </div>`;
}

module.exports = EmailTemplate;
