/** Shared Resend helpers — server only. */

const AMP = String.fromCharCode(38);

/** Escape for HTML email bodies without using entity literals. */
export function escapeHtml(value: string): string {
  return value
    .split(AMP)
    .join(AMP + "amp;")
    .split("<")
    .join(AMP + "lt;")
    .split(">")
    .join(AMP + "gt;")
    .split('"')
    .join(AMP + "quot;")
    .split("'")
    .join(AMP + "#39;");
}

export const ADMIN_EMAIL = "admin@justwheels.co.za";
export const SPONSORS_FROM = "Just Wheels Sponsors <sponsors@notify.justwheels.co.za>";
export const SITE_ORIGIN = "https://www.justwheels.co.za";

export function emailShell(title: string, bodyHtml: string): string {
  return (
    '<div style="font-family:Arial,sans-serif;color:#111;max-width:560px">' +
    '<h2 style="margin:0 0 12px">' +
    escapeHtml(title) +
    "</h2>" +
    bodyHtml +
    '<p style="margin:24px 0 0;font-size:12px;color:#888">Just Wheels Hessequa</p>' +
    "</div>"
  );
}

export async function sendEmail(input: {
  to: string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}): Promise<void> {
  const key = process.env["RESEND_API_KEY"];
  if (!key) throw new Error("RESEND_API_KEY not configured");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
    body: JSON.stringify({
      from: input.from ?? SPONSORS_FROM,
      to: input.to,
      subject: input.subject,
      html: input.html,
      ...(input.replyTo ? { reply_to: input.replyTo } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("Resend failed [" + res.status + "]: " + body);
    throw new Error("Email send failed (" + res.status + ")");
  }
}
