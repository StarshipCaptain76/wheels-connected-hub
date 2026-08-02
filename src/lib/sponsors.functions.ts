import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { createPublicSupabase } from "./public-supabase.server";
import { buildSponsorApplicationAdminEmail } from "./sponsor-application-email.server";

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
  logo_url: string;

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
        "id, name, tagline, tagline_af, website_url, logo_path, is_active, sort, billing_starts_at, billing_ends_at, expiry_notified_at, owner_user_id",
      )
      .order("sort", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw error;
    const out: AdminSponsor[] = [];
    for (const row of data ?? []) {
      const logo_path = row.logo_path as string;
      let logo_url = logo_path;
      if (logo_path && !/^https?:\/\//i.test(logo_path)) {
        const { data: signed } = await supabase.storage
          .from("sponsors")
          .createSignedUrl(logo_path, 60 * 60);
        logo_url = signed?.signedUrl ?? "";
      }
      out.push({
        id: row.id as string,
        name: row.name as string,
        tagline: (row.tagline as string | null) ?? null,
        tagline_af: (row.tagline_af as string | null) ?? null,
        website_url: (row.website_url as string | null) ?? null,
        logo_path,
        logo_url,
        is_active: Boolean(row.is_active),
        sort: Number(row.sort ?? 0),
        billing_starts_at: row.billing_starts_at
          ? String(row.billing_starts_at).slice(0, 10)
          : null,
        billing_ends_at: row.billing_ends_at ? String(row.billing_ends_at).slice(0, 10) : null,
        expiry_notified_at: (row.expiry_notified_at as string | null) ?? null,
        owner_user_id: (row.owner_user_id as string | null) ?? null,
      });
    }
    return out;


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
  owner_user_id: z.string().uuid().nullable().optional(),
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
      owner_user_id: rest.owner_user_id ?? null,
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

    const subject = "New sponsor application — " + data.business + " (approval needed)";


    // Store the application so admin can review + approve it
    let stored = false;
    try {
      const sb = createPublicSupabase();
      const { error } = await sb.from("sponsor_applications").insert({
        business: data.business,
        contact_name: data.contact,
        email: data.email,
        phone: data.phone || null,
        website: data.website || null,
        message: data.message || null,
      });
      if (error) throw error;
      stored = true;
    } catch (e) {
      console.error("[sponsors] could not store application", e);
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
      body: JSON.stringify({
        from: FROM,
        to: [ADMIN_EMAIL],
        reply_to: data.email,
        subject,
        html: buildSponsorApplicationAdminEmail({
          business: data.business,
          contact: data.contact,
          email: data.email,
          phone: data.phone,
          website: data.website,
          message: data.message,
          stored,
        }),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("Resend failed [" + res.status + "]: " + body);
      throw new Error("Email send failed (" + res.status + ")");
    }

    // Confirmation to the applicant
    try {
      const confirmation =
        '<div style="font-family:Arial,sans-serif;color:#111;max-width:560px">' +
        '<h2 style="margin:0 0 12px">We received your sponsorship application</h2>' +
        '<p style="margin:0 0 12px">Hi ' +
        escapeHtml(data.contact) +
        ", thank you for applying to sponsor <strong>Just Wheels Hessequa</strong> as <strong>" +
        escapeHtml(data.business) +
        "</strong>.</p>" +
        '<p style="margin:0 0 12px">Our committee will review your application and come back to you. Once approved you will receive a link to set up your sponsor card on the club site.</p>' +
        '<p style="margin:0 0 12px;color:#555">Questions? Just reply to this email.</p>' +
        '<p style="margin:24px 0 0;font-size:12px;color:#888">Just Wheels Hessequa</p></div>';

      const confirmRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
        body: JSON.stringify({
          from: FROM,
          to: [data.email],
          reply_to: ADMIN_EMAIL,
          subject: "We received your Just Wheels sponsorship application",
          html: confirmation,
        }),
      });
      if (!confirmRes.ok) {
        console.error("[sponsors] applicant confirmation failed", await confirmRes.text());
      }
    } catch (e) {
      console.error("[sponsors] applicant confirmation failed", e);
    }

    return { ok: true as const };
  });

/* ------------------------------------------------------------------ */
/* Member-owned sponsor card                                           */
/* ------------------------------------------------------------------ */

export const getMySponsor = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MySponsor | null> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("sponsors")
      .select(
        "id, name, tagline, tagline_af, website_url, logo_path, is_active, billing_starts_at, billing_ends_at",
      )
      .eq("owner_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    const logo_path = data.logo_path as string;
    let logo_url = logo_path;
    if (!/^https?:\/\//i.test(logo_path)) {
      const { data: signed } = await supabase.storage
        .from("sponsors")
        .createSignedUrl(logo_path, 60 * 60);
      logo_url = signed?.signedUrl ?? "";
    }
    const ends = data.billing_ends_at ? String(data.billing_ends_at).slice(0, 10) : null;
    return {
      id: data.id as string,
      name: data.name as string,
      tagline: (data.tagline as string | null) ?? null,
      tagline_af: (data.tagline_af as string | null) ?? null,
      website_url: (data.website_url as string | null) ?? null,
      logo_path,
      logo_url,
      is_active: Boolean(data.is_active),
      billing_starts_at: data.billing_starts_at
        ? String(data.billing_starts_at).slice(0, 10)
        : null,
      billing_ends_at: ends,
      expired: Boolean(ends && ends < todayISO()),
    };
  });

const mySponsorSchema = z.object({
  name: z.string().trim().min(1).max(120),
  tagline: z.string().trim().max(200).nullable().optional(),
  tagline_af: z.string().trim().max(200).nullable().optional(),
  website_url: z.string().trim().max(500).nullable().optional(),
  logo_path: z.string().trim().min(1).max(500),
});

export const updateMySponsor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => mySponsorSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: current, error: readErr } = await supabase
      .from("sponsors")
      .select("id, billing_ends_at")
      .eq("owner_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (readErr) throw readErr;
    if (!current) throw new Error("You do not have a sponsor card");

    const ends = current.billing_ends_at ? String(current.billing_ends_at).slice(0, 10) : null;
    if (ends && ends < todayISO()) {
      throw new Error("Your sponsorship has expired — please contact the club admin");
    }

    const { error } = await supabase
      .from("sponsors")
      .update({
        name: data.name,
        tagline: data.tagline ?? null,
        tagline_af: data.tagline_af ?? null,
        website_url: data.website_url ?? null,
        logo_path: data.logo_path,
      })
      .eq("id", current.id as string);
    if (error) throw error;
    return { ok: true as const };
  });

