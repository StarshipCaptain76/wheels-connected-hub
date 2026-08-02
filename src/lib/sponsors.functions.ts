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
  owner_user_id: string | null;
};

export type MySponsor = {
  id: string;
  name: string;
  tagline: string | null;
  tagline_af: string | null;
  website_url: string | null;
  logo_path: string;
  logo_url: string;
  is_active: boolean;
  billing_starts_at: string | null;
  billing_ends_at: string | null;
  expired: boolean;
};


function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Escape for HTML email bodies without using entity literals (they get mangled in some pipelines). */
function escapeHtml(value: string): string {
  const amp = String.fromCharCode(38);
  return value
    .split(amp)
    .join(amp + "amp;")
    .split("<")
    .join(amp + "lt;")
    .split(">")
    .join(amp + "gt;")
    .split('"')
    .join(amp + "quot;")
    .split("'")
    .join(amp + "#39;");
}

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
    if (start && String(start).slice(0, 10) > today) return false;
    if (end && String(end).slice(0, 10) < today) return false;
    return true;
  });

  const out: Sponsor[] = [];
  for (const row of rows) {
    let logo_url = row.logo_path as string;
    if (!/^https?:\/\//i.test(logo_url)) {
      const { data: signed } = await sb.storage
        .from("sponsors")
        .createSignedUrl(logo_url, 60 * 60 * 24 * 7);
      logo_url = signed?.signedUrl ?? "";
    }
    out.push({
      id: row.id as string,
      name: row.name as string,
      tagline: (row.tagline as string | null) ?? null,
      tagline_af: (row.tagline_af as string | null) ?? null,
      website_url: (row.website_url as string | null) ?? null,
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
    return (data ?? []).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      tagline: (row.tagline as string | null) ?? null,
      tagline_af: (row.tagline_af as string | null) ?? null,
      website_url: (row.website_url as string | null) ?? null,
      logo_path: row.logo_path as string,
      is_active: Boolean(row.is_active),
      sort: Number(row.sort ?? 0),
      billing_starts_at: row.billing_starts_at
        ? String(row.billing_starts_at).slice(0, 10)
        : null,
      billing_ends_at: row.billing_ends_at ? String(row.billing_ends_at).slice(0, 10) : null,
      expiry_notified_at: (row.expiry_notified_at as string | null) ?? null,
    }));
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
  billing_starts_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  billing_ends_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

export const upsertSponsor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => upsertSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { id, ...rest } = data;

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from("sponsors").update(values as any).eq("id", id);
      if (error) throw error;
      return { id };
    }
    const { data: row, error } = await supabase
      .from("sponsors")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(values as any)
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id as string };
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

const applySchema = z.object({
  business: z.string().trim().min(1).max(120),
  contact: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(40).optional().default(""),
  website: z.string().trim().max(255).optional().default(""),
  message: z.string().trim().max(2000).optional().default(""),
});

const ADMIN_EMAIL = "admin@justwheels.co.za";
const FROM = "Just Wheels Sponsors <sponsors@notify.justwheels.co.za>";

export const applySponsor = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => applySchema.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY not configured");

    const subject = "Sponsor application — " + data.business;
    const rows = [
      ["Business", "<strong>" + escapeHtml(data.business) + "</strong>"],
      ["Contact", escapeHtml(data.contact)],
      [
        "Email",
        '<a href="mailto:' + escapeHtml(data.email) + '">' + escapeHtml(data.email) + "</a>",
      ],
    ];
    if (data.phone) rows.push(["Phone", escapeHtml(data.phone)]);
    if (data.website) rows.push(["Website", escapeHtml(data.website)]);
    if (data.message) rows.push(["Message", escapeHtml(data.message)]);

    const table = rows
      .map(
        ([label, value]) =>
          '<tr><td style="padding:6px 0;color:#666">' +
          label +
          '</td><td style="padding:6px 0">' +
          value +
          "</td></tr>",
      )
      .join("");

    const html =
      '<div style="font-family:Arial,sans-serif;color:#111;max-width:560px">' +
      "<h2 style=\"margin:0 0 12px\">New sponsor application</h2>" +
      '<p style="margin:0 0 16px;color:#555">Sent from justwheels.co.za sponsors page</p>' +
      '<table style="border-collapse:collapse;width:100%"><tbody>' +
      table +
      "</tbody></table></div>";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
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
      console.error("Resend failed [" + res.status + "]: " + body);
      throw new Error("Email send failed (" + res.status + ")");
    }
    return { ok: true as const };
  });
