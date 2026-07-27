import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ADMIN_EMAIL = "admin@justwheels.co.za";
const FROM = "Just Wheels Shop <shop@notify.justwheels.co.za>";

const schema = z.object({
  itemId: z.string().min(1).max(64),
  itemName: z.string().min(1).max(120),
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(40).optional().default(""),
  size: z.string().trim().max(20).optional().default(""),
  quantity: z.coerce.number().int().min(1).max(50),
  notes: z.string().trim().max(1000).optional().default(""),
});

function esc(v: string) {
  return v.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}

export const sendMerchEnquiry = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY not configured");

    const subject = `Merch enquiry — ${data.itemName} (x${data.quantity})`;
    const html = `
      <div style="font-family:Arial,sans-serif;color:#111;max-width:560px">
        <h2 style="margin:0 0 12px">New merch enquiry</h2>
        <p style="margin:0 0 16px;color:#555">Sent from justwheels.co.za shop</p>
        <table style="border-collapse:collapse;width:100%">
          <tbody>
            <tr><td style="padding:6px 0;color:#666">Item</td><td style="padding:6px 0"><strong>${esc(data.itemName)}</strong> <span style="color:#888">(${esc(data.itemId)})</span></td></tr>
            <tr><td style="padding:6px 0;color:#666">Quantity</td><td style="padding:6px 0">${data.quantity}</td></tr>
            ${data.size ? `<tr><td style="padding:6px 0;color:#666">Size</td><td style="padding:6px 0">${esc(data.size)}</td></tr>` : ""}
            <tr><td style="padding:6px 0;color:#666">Name</td><td style="padding:6px 0">${esc(data.name)}</td></tr>
            <tr><td style="padding:6px 0;color:#666">Email</td><td style="padding:6px 0"><a href="mailto:${esc(data.email)}">${esc(data.email)}</a></td></tr>
            ${data.phone ? `<tr><td style="padding:6px 0;color:#666">Phone</td><td style="padding:6px 0">${esc(data.phone)}</td></tr>` : ""}
            ${data.notes ? `<tr><td style="padding:6px 0;color:#666;vertical-align:top">Notes</td><td style="padding:6px 0;white-space:pre-wrap">${esc(data.notes)}</td></tr>` : ""}
          </tbody>
        </table>
        <p style="margin-top:24px;color:#666;font-size:12px">Reply directly to this email to contact the buyer.</p>
      </div>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        from: FROM,
        to: [ADMIN_EMAIL],
        reply_to: data.email,
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`Resend failed [${res.status}]: ${body}`);
      throw new Error(`Email send failed (${res.status})`);
    }

    return { ok: true as const };
  });
