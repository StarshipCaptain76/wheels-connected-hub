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
};

export const listSponsors = createServerFn({ method: "GET" }).handler(async (): Promise<Sponsor[]> => {
  const sb = createPublicSupabase();
  const { data, error } = await sb
    .from("sponsors")
    .select("id, name, tagline, tagline_af, website_url, logo_path, sort")
    .eq("is_active", true)
    .order("sort", { ascending: true })
    .order("name", { ascending: true });
  if (error) {
    console.error("listSponsors failed", error);
    return [];
  }

  const out: Sponsor[] = [];
  for (const row of data ?? []) {
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
      .select("id, name, tagline, tagline_af, website_url, logo_path, is_active, sort")
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
});

export const upsertSponsor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => upsertSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { id, ...values } = data;
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

function esc(v: string) {
  return v.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}

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
