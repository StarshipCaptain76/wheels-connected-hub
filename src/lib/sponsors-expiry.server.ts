/**
 * Server-only: deactivate expired sponsors and email admin once.
 * Keep out of sponsors.functions.ts so the client server-fn transform
 * never tries to bundle supabaseAdmin / process.env server code.
 */

const ADMIN_EMAIL = "admin@justwheels.co.za";
const FROM = "Just Wheels Sponsors <sponsors@notify.justwheels.co.za>";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function esc(v: string) {
  return v.replace(/[&<>"']/g, (c) =>
    ({ "&": "&", "<": "<", ">": ">", '"': """, "'": "&#39;" })[c] ?? c,
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso.slice(0, 10) + "T12:00:00Z").toLocaleDateString("en-ZA", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

async function sendSponsorExpiredEmail(opts: {
  name: string;
  starts: string | null;
  ends: string | null;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error("[sponsors] RESEND_API_KEY missing — skip expiry email");
    return false;
  }

  const subject = `Sponsorship ended — ${opts.name} (renewal needed)`;
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#111;max-width:560px;line-height:1.5">
      <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#c41e3a">Just Wheels Hessequa</p>
      <h2 style="margin:0 0 16px;font-size:22px">Sponsorship has ended</h2>
      <p style="margin:0 0 16px;color:#444">
        The billing period for <strong>${esc(opts.name)}</strong> has finished.
        Their logo has been hidden from the website until the sponsorship is renewed.
      </p>
      <table style="border-collapse:collapse;width:100%;margin:0 0 20px;background:#f7f7f7;border-radius:8px">
        <tbody>
          <tr>
            <td style="padding:12px 16px;color:#666;width:40%">Sponsor</td>
            <td style="padding:12px 16px"><strong>${esc(opts.name)}</strong></td>
          </tr>
          <tr>
            <td style="padding:12px 16px;color:#666">Billing start</td>
            <td style="padding:12px 16px">${esc(formatDate(opts.starts))}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;color:#666">Billing end</td>
            <td style="padding:12px 16px">${esc(formatDate(opts.ends))}</td>
          </tr>
        </tbody>
      </table>
      <p style="margin:0 0 16px;color:#444">
        To renew: open the <a href="https://www.justwheels.co.za/admin/sponsors">Admin → Sponsors</a>
        page, set a new end date, and mark the sponsor <strong>Active</strong> again.
      </p>
      <p style="margin:0;font-size:12px;color:#888">
        Automated notice from justwheels.co.za · admin@justwheels.co.za
      </p>
    </div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      from: FROM,
      to: [ADMIN_EMAIL],
      subject,
      html,
    }),
  });
  if (!res.ok) {
    console.error(`[sponsors] expiry email failed [${res.status}]: ${await res.text()}`);
    return false;
  }
  return true;
}

export async function processExpiredSponsors(): Promise<{ expired: number; emailed: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const today = todayISO();

  const { data: expired, error } = await supabaseAdmin
    .from("sponsors")
    .select("id, name, billing_starts_at, billing_ends_at, is_active, expiry_notified_at")
    .not("billing_ends_at", "is", null)
    .lt("billing_ends_at", today);
  if (error) throw new Error(error.message);

  let emailed = 0;
  for (const s of expired ?? []) {
    if (s.is_active) {
      await supabaseAdmin.from("sponsors").update({ is_active: false }).eq("id", s.id);
    }
    if (!s.expiry_notified_at) {
      const sent = await sendSponsorExpiredEmail({
        name: s.name as string,
        starts: (s.billing_starts_at as string | null) ?? null,
        ends: (s.billing_ends_at as string | null) ?? null,
      });
      if (sent) {
        await supabaseAdmin
          .from("sponsors")
          .update({ expiry_notified_at: new Date().toISOString() })
          .eq("id", s.id);
        emailed += 1;
      }
    }
  }
  return { expired: (expired ?? []).length, emailed };
}
