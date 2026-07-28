import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { createPublicSupabase } from "./public-supabase.server";

export type Sponsor = {
  id: string;
  name: string;
  tagline: string | null;
  tagline_af: string | null;
  website_url: string | null;
  logo_url: string;
};

export type AdminSponsor = {
  id: string;
  name: string;
  tagline: string | null;
  tagline_af: string | null;
  website_url: string | null;
  logo_path: string;
  is_active: boolean;
  sort: number;
  billing_starts_at: string | null;
  billing_ends_at: string | null;
  expiry_notified_at: string | null;
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Public list: active + within billing window */
export const listSponsors = createServerFn({ method: "GET" }).handler(async (): Promise<Sponsor[]> => {
  const sb = createPublicSupabase();
  const today = todayISO();

  const { data, error } = await sb
    .from("sponsors")
    .select("id, name, tagline, tagline_af, website_url, logo_path, sort, billing_starts_at, billing_ends_at")
    .eq("is_active", true)
    .order("sort", { ascending: true })
    .order("name", { ascending: true });
  if (error) {
    console.error("listSponsors failed", error);
    return [];
  }

  const rows = (data ?? []).filter((row) => {
    const start = row.billing_starts_at as string | null;
    const end = row.billing_ends_at as string | null;
    if (start && start > today) return false;
    if (end && end < today) return false;
    return true;
  });

  const out: Sponsor[] = [];
  for (const row of rows) {
    let logo_url = row.logo_path;
    if (!/^https?:\/\//i.test(row.logo_path)) {
      const { data: signed } = await sb.storage
        .from("sponsors")
        .createSignedUrl(row.logo_path, 60 * 60 * 24 * 7);
      logo_url = signed?.signedUrl ?? "";
    }
    out.push({
      id: row.id,
      name: row.name,
      tagline: row.tagline,
      tagline_af: row.tagline_af,
      website_url: row.website_url,
      logo_url,
    });
  }
  return out;
});

export const listAllSponsors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminSponsor[]> => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { data, error } = await supabase
      .from("sponsors")
      .select(
        "id, name, tagline, tagline_af, website_url, logo_path, is_active, sort, billing_starts_at, billing_ends_at, expiry_notified_at",
      )
      .order("sort", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw error;
    return (data ?? []) as AdminSponsor[];
  });

const upsertSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  name: z.string().trim().min(1).max(120),
  tagline: z.string().trim().max(200).nullable().optional(),
  tagline_af: z.string().trim().max(200).nullable().optional(),
  website_url: z.string().trim().max(500).nullable().optional(),
  logo_path: z.string().trim().min(1).max(500),
  is_active: z.boolean().default(true),
  sort: z.number().int().min(0).max(9999).default(0),
  billing_starts_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  billing_ends_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export const upsertSponsor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => upsertSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { id, ...rest } = data;

    // Extending end date past today clears previous expiry notification
    const values: Record<string, unknown> = {
      name: rest.name,
      tagline: rest.tagline ?? null,
      tagline_af: rest.tagline_af ?? null,
      website_url: rest.website_url ?? null,
      logo_path: rest.logo_path,
      is_active: rest.is_active,
      sort: rest.sort,
      billing_starts_at: rest.billing_starts_at ?? null,
      billing_ends_at: rest.billing_ends_at ?? null,
    };
    if (rest.billing_ends_at && rest.billing_ends_at >= todayISO()) {
      values.expiry_notified_at = null;
    }

    if (id) {
      const { error } = await supabase.from("sponsors").update(values).eq("id", id);
      if (error) throw error;
      return { id };
    }
    const { data: row, error } = await supabase.from("sponsors").insert(values).select("id").single();
    if (error) throw error;
    return { id: row.id };
  });

export const deleteSponsor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await supabase.from("sponsors").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

const ADMIN_EMAIL = "admin@justwheels.co.za";
const FROM = "Just Wheels Sponsors <sponsors@notify.justwheels.co.za>";

function esc(v: string) {
  return v.replace(/[&<>"']/g, (c) =>
    ({ "&": "&", "<": "<", ">": ">", '"': """, "'": "&#39;" }[c]!),
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso + (iso.length === 10 ? "T12:00:00Z" : "")).toLocaleDateString("en-ZA", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

/** Hide expired sponsors and email admin once per expiry cycle */
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
        starts: s.billing_starts_at as string | null,
        ends: s.billing_ends_at as string | null,
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

const applySchema = z.object({
  business: z.string().trim().min(1).max(120),
  contact: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(40).optional().default(""),
  website: z.string().trim().max(255).optional().default(""),
  message: z.string().trim().max(2000).optional().default(""),
});

export const applySponsor = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => applySchema.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY not configured");

    const subject = `Sponsor application — ${data.business}`;
    const html = `
      <div style="font-family:Arial,sans-serif;color:#111;max-width:560px">
        <h2 style="margin:0 0 12px">New sponsor application</h2>
        <p style="margin:0 0 16px;color:#555">Sent from justwheels.co.za sponsors page</p>
        <table style="border-collapse:collapse;width:100%">
          <tbody>
            <tr><td style="padding:6px 0;color:#666">Business</td><td style="padding:6px 0"><strong>${esc(data.business)}</strong></td></tr>
            <tr><td style="padding:6px 0;color:#666">Contact</td><td style="padding:6px 0">${esc(data.contact)}</td></tr>
            <tr><td style="padding:6px 0;color:#666">Email</td><td style="padding:6px 0"><a href="mailto:${esc(data.email)}">${esc(data.email)}</a></td></tr>
            ${data.phone ? `<tr><td style="padding:6px 0;color:#666">Phone</td><td style="padding:6px 0">${esc(data.phone)}</td></tr>` : ""}
            ${data.website ? `<tr><td style="padding:6px 0;color:#666">Website</td><td style="padding:6px 0">${esc(data.website)}</td></tr>` : ""}
            ${data.message ? `<tr><td style="padding:6px 0;color:#666;vertical-align:top">Message</td><td style="padding:6px 0;white-space:pre-wrap">${esc(data.message)}</td></tr>` : ""}
          </tbody>
        </table>
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
      console.error(`Resend failed [${res.status}]: ${body}`);
      throw new Error(`Email send failed (${res.status})`);
    }
    return { ok: true as const };
  });
