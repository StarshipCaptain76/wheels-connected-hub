import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ADMIN_EMAIL = "admin@justwheels.co.za";
const FROM = "Just Wheels Contact <contact@notify.justwheels.co.za>";

const contactSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  phone: z
    .string()
    .trim()
    .min(7, "Mobile number is required")
    .max(40)
    .regex(/^[+\d\s()-]+$/, "Enter a valid mobile number"),
  message: z.string().trim().min(1).max(2000),
});

function esc(v: string) {
  return v.replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = {
      "&": "&",
      "<": "<",
      ">": ">",
      '"': """,
      "'": "&#39;",
    };
    return map[c] ?? c;
  });
}

export const sendContactMessage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => contactSchema.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("Email service not configured");

    const subject = `Contact form — ${data.name}`;
    const html = `
      <div style="font-family:Arial,sans-serif;color:#111;max-width:560px">
        <h2 style="margin:0 0 12px">New contact form message</h2>
        <p style="margin:0 0 16px;color:#555">Sent from justwheels.co.za/contact</p>
        <table style="border-collapse:collapse;width:100%">
          <tbody>
            <tr><td style="padding:6px 0;color:#666">From</td><td style="padding:6px 0"><strong>${esc(data.name)}</strong></td></tr>
            <tr><td style="padding:6px 0;color:#666">Email</td><td style="padding:6px 0"><a href="mailto:${esc(data.email)}">${esc(data.email)}</a></td></tr>
            <tr><td style="padding:6px 0;color:#666">Mobile</td><td style="padding:6px 0"><a href="tel:${esc(data.phone.replace(/\s/g, ""))}">${esc(data.phone)}</a></td></tr>
            <tr><td style="padding:12px 0 6px;color:#666;vertical-align:top">Message</td><td style="padding:12px 0 6px;white-space:pre-wrap">${esc(data.message)}</td></tr>
          </tbody>
        </table>
        <p style="margin-top:24px;color:#666;font-size:12px">Reply directly to this email to respond.</p>
      </div>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
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
      console.error(`Resend contact failed [${res.status}]: ${body}`);
      throw new Error(`Email send failed (${res.status})`);
    }
    return { ok: true as const };
  });
