import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";


const ADMIN_EMAIL = "admin@justwheels.co.za";
const FROM = "Just Wheels <news@notify.justwheels.co.za>";
const SITE_URL = "https://www.justwheels.co.za";

function esc(v: string) {
  return v.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}

async function sendResend(payload: Record<string, unknown>) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not configured");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Resend failed [${res.status}]: ${body}`);
    throw new Error(`Email send failed (${res.status})`);
  }
  return res.json();
}

// ---------------- Subscribe (public) ----------------
const subscribeSchema = z.object({
  email: z.string().trim().email().max(255),
  lang: z.enum(["en", "af"]).default("en"),
  source: z.string().trim().max(60).optional().default("footer"),
});

export const subscribeNewsletter = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => subscribeSchema.parse(input))
  .handler(async ({ data }) => {
    const { elevated } = await import("./elevated.server");
    const sb = await elevated();
    const { data: rpcToken, error: subErr } = await sb.rpc("newsletter_subscribe", {
      _email: data.email,
      _lang: data.lang,
      _source: data.source,
    });
    if (subErr || !rpcToken) {
      console.error("subscribe failed", subErr);
      throw new Error("Could not subscribe. Try again.");
    }
    const token = rpcToken as string;

    const unsubUrl = `${SITE_URL}/api/public/newsletter/unsubscribe?token=${token}`;
    const isAf = data.lang === "af";
    const subject = isAf ? "Welkom by Just Wheels Hessequa" : "Welcome to Just Wheels Hessequa";
    const html = `
      <div style="font-family:Arial,sans-serif;color:#111;max-width:560px">
        <h2 style="margin:0 0 12px">${isAf ? "Welkom by die klub" : "Welcome to the club"}</h2>
        <p style="margin:0 0 16px;color:#333">
          ${isAf
            ? "Jy sal nou opdaterings kry oor komende ritte, klub nuus en spesiale aanbiedings."
            : "You'll now get updates about upcoming runs, club news, and members-only offers."}
        </p>
        <p style="margin:0 0 24px">
          <a href="${SITE_URL}/events" style="display:inline-block;background:#c1121f;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold">
            ${isAf ? "Sien komende geleenthede" : "See upcoming events"}
          </a>
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
        <p style="font-size:12px;color:#666">
          ${isAf ? "Wil jy nie meer e-posse ontvang nie?" : "Don't want these emails?"}
          <a href="${unsubUrl}" style="color:#666">${isAf ? "Kanselleer intekening" : "Unsubscribe"}</a>
        </p>
      </div>`;

    await sendResend({
      from: FROM,
      to: [data.email],
      subject,
      html,
      headers: { "List-Unsubscribe": `<${unsubUrl}>` },
    });

    return { ok: true as const };
  });

// ---------------- Admin: list subscribers ----------------
export type Subscriber = {
  id: string;
  email: string;
  lang: "en" | "af";
  subscribed_at: string;
  unsubscribed_at: string | null;
  source: string | null;
};

export const listSubscribers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Subscriber[]> => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { data, error } = await supabase
      .from("newsletter_subscribers")
      .select("id, email, lang, subscribed_at, unsubscribed_at, source")
      .order("subscribed_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Subscriber[];
  });

// ---------------- Admin: send newsletter ----------------
const sendSchema = z.object({
  subjectEn: z.string().trim().min(1).max(200),
  subjectAf: z.string().trim().max(200).optional().default(""),
  bodyEn: z.string().trim().min(1).max(20000),
  bodyAf: z.string().trim().max(20000).optional().default(""),
  testOnly: z.boolean().optional().default(false),
});

function renderNewsletter(bodyHtml: string, unsubUrl: string, isAf: boolean) {
  return `
    <div style="font-family:Arial,sans-serif;color:#111;max-width:600px;margin:0 auto">
      <div style="background:#c1121f;color:#fff;padding:16px 20px;border-radius:6px 6px 0 0">
        <div style="font-family:'Bebas Neue',Arial,sans-serif;font-size:22px;letter-spacing:2px">JUST WHEELS HESSEQUA</div>
      </div>
      <div style="padding:20px;background:#fff;border:1px solid #eee;border-top:none;border-radius:0 0 6px 6px">
        ${bodyHtml}
      </div>
      <p style="font-size:12px;color:#666;text-align:center;margin-top:16px">
        ${isAf ? "Jy ontvang hierdie omdat jy ingeteken het by justwheels.co.za." : "You're receiving this because you subscribed at justwheels.co.za."}<br/>
        <a href="${unsubUrl}" style="color:#666">${isAf ? "Kanselleer intekening" : "Unsubscribe"}</a>
      </p>
    </div>`;
}

export const sendNewsletter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => sendSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { data: subs, error } = await supabase
      .from("newsletter_subscribers")
      .select("email, lang, unsubscribe_token, unsubscribed_at");
    if (error) throw error;

    const active = (subs ?? []).filter((s) => !s.unsubscribed_at);
    const recipients = data.testOnly
      ? active.filter((s) => s.email === ADMIN_EMAIL).slice(0, 1)
      : active;

    if (data.testOnly && recipients.length === 0) {
      // Send a preview to admin using a synthetic token.
      const previewToken = "preview";
      const unsubUrl = `${SITE_URL}/api/public/newsletter/unsubscribe?token=${previewToken}`;
      await sendResend({
        from: FROM,
        to: [ADMIN_EMAIL],
        subject: `[TEST] ${data.subjectEn}`,
        html: renderNewsletter(data.bodyEn, unsubUrl, false),
        headers: { "List-Unsubscribe": `<${unsubUrl}>` },
      });
      return { ok: true as const, sent: 1, test: true };
    }

    let sent = 0;
    const failures: string[] = [];
    // Send sequentially to stay under Resend rate limits (10/s free tier).
    for (const s of recipients) {
      const isAf = s.lang === "af";
      const subject = isAf && data.subjectAf ? data.subjectAf : data.subjectEn;
      const body = isAf && data.bodyAf ? data.bodyAf : data.bodyEn;
      const unsubUrl = `${SITE_URL}/api/public/newsletter/unsubscribe?token=${s.unsubscribe_token}`;
      try {
        await sendResend({
          from: FROM,
          to: [s.email],
          subject: data.testOnly ? `[TEST] ${subject}` : subject,
          html: renderNewsletter(body, unsubUrl, isAf),
          headers: { "List-Unsubscribe": `<${unsubUrl}>` },
        });
        sent++;
        // Small delay to respect rate limits
        await new Promise((r) => setTimeout(r, 120));
      } catch (e) {
        failures.push(s.email);
        console.error(`Newsletter to ${s.email} failed`, e);
      }
    }

    if (!data.testOnly && sent > 0) {
      try {
        const { fanOut } = await import("./notify.server");
        await fanOut({
          type: "new_newsletter",
          title_en: "New club newsletter",
          title_af: "Nuwe klubnuusbrief",
          body_en: data.subjectEn,
          body_af: data.subjectAf || data.subjectEn,
          link: "/",
        }, supabase);
      } catch (e) {
        console.error("[newsletter] notification failed", e);
      }
    }

    return { ok: true as const, sent, failed: failures.length, test: data.testOnly };
  });
