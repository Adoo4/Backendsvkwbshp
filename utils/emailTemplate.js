function EmailTemplate(order, itemsList, deliveryText, isAdmin = false) {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif; background:#f7f7f7; padding:30px;">
  <div style="max-width:600px; background:#ffffff; margin:0 auto; border-radius:8px; overflow:hidden; border:1px solid #dddddd;">

    <!-- HEADER -->
    <div style="background:#222222; color:#ffffff; padding:18px; text-align:center;">
      <img src="cid:maillogo.png" alt="Bookstore Logo" style="max-width:180px; display:block; margin:0 auto 8px;" />
    </div>

    <!-- CONTENT WRAPPER -->
    <div style="padding:24px;">

      ${isAdmin ? `
        <h2 style="margin:0 0 8px; color:#333333; font-size:20px;">
          Nova narudžba primljena!
        </h2>
        <p style="font-size:15px; color:#333333; margin:0;">
          <b>Broj narudžbe:</b> #${order.paymentId}
        </p>
      ` : `
        <h2 style="margin:0 0 8px; color:#333333; font-size:20px;">
          Hvala na kupovini, ${order.shipping.fullName}! 
        </h2>
        <p style="font-size:15px; color:#333333; margin:0 0 8px;">
          <b>Broj narudžbe:</b> #${order.paymentId}
        </p>
        <p style="color:#555555; font-size:15px; margin:0;">
          Vaša narudžba je uspješno zabilježena i obrađena.
        </p>
      `}

      <hr style="border:none; border-top:1px solid #eeeeee; margin:20px 0;" />

      <h3 style="color:#333333; font-size:17px; margin:0 0 10px;">
        🧾 Detalji narudžbe
      </h3>

      <div style="margin-bottom:20px;">
        ${itemsList}
      </div>

      <p style="font-size:16px; margin:0 0 12px;">
        <b>Ukupno:</b>
        <span style="color:#111111;">${order.totalAmount} KM</span>
      </p>

      <p style="font-size:14px; color:#444444; margin:0 0 20px;">
        <b>Dostava:</b> ${deliveryText}<br />
        <i style="color:#777777;">
          (Trošak dostave je uključen u ukupnu cijenu)
        </i>
      </p>

      <hr style="border:none; border-top:1px solid #eeeeee; margin:20px 0;" />

      <h3 style="color:#333333; font-size:17px; margin:0 0 10px;">
        📦 Podaci za dostavu
      </h3>

      <p style="font-size:14px; color:#444444; margin:0;">
        ${order.shipping.fullName}<br />
        ${order.shipping.address}<br />
        ${order.shipping.city}, ${order.shipping.zip}<br />
        Email: ${order.shipping.email}<br />
        Telefon: ${order.shipping.phone}
      </p>

      <div style="margin-top:30px; font-size:13px; color:#666666;">
        Hvala na povjerenju!<br />
        <b>Bookstore by Svjetlostkomerc</b>
      </div>

    </div>
  </div>
</div>
`;
}
module.exports = EmailTemplate;
