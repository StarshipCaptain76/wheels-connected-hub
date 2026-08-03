import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ADMIN_EMAIL = "admin@justwheels.co.za";
const FROM = "Just Wheels Shop <shop@notify.justwheels.co.za>";

export type MerchItem = {
  id: string;
  name: string;
  name_af: string | null;
  description: string | null;
  description_af: string | null;
  price_zar: number | null;
  sizes: string[];
  image_url: string | null;
  /** Place/channel where the item is available to buy or collect. */
  available_from: string | null;
  is_active: boolean;
  sort: number;
};

const MERCH_SELECT =
  "id, name, name_af, description, description_af, price_zar, sizes, image_url, available_from, is_active, sort";

export const listMerchItems = createServerFn({ method: "GET" }).handler(
  async (): Promise<MerchItem[]> => {
    const { createPublicSupabase } = await import("./public-supabase.server");
    const { signStoredUrls } = await import("./storage-urls.server");
    const sb = createPublicSupabase();
    const { data, error } = await sb
      .from("merch_items")
      .select(MERCH_SELECT)
      .eq("is_active", true)
      .order("sort", { ascending: true })
      .order("name", { ascending: true });
    if (error) {
      console.error("listMerchItems failed", error);
      return [];
    }
    const rows = (data ?? []) as MerchItem[];
    const signed = await signStoredUrls(
      sb,
      rows.map((r) => r.image_url),
    );
    return rows.map((r) => ({
      ...r,
      image_url: r.image_url ? (signed.get(r.image_url) ?? r.image_url) : null,
    }));
  },
);

export const listAllMerchItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MerchItem[]> => {
    const { supabase, userId } = context;
    const { signStoredUrls } = await import("./storage-urls.server");
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { data, error } = await supabase
      .from("merch_items")
      .select(MERCH_SELECT)
      .order("sort", { ascending: true });
    if (error) throw error;
    const rows = (data ?? []) as MerchItem[];
    const signed = await signStoredUrls(
      supabase,
      rows.map((r) => r.image_url),
    );
    return rows.map((r) => ({
      ...r,
      image_url: r.image_url ? (signed.get(r.image_url) ?? r.image_url) : null,
    }));
  });

// Per-size label max raised from 10 → 40 so values like "One Size" / "XXL" work.
// Overall sizes list still capped at 20 entries.
const upsertSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  name: z.string().trim().min(1).max(120),
  name_af: z.string().trim().max(120).nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  description_af: z.string().trim().max(1000).nullable().optional(),
  price_zar: z.number().nonnegative().max(999999).nullable().optional(),
  sizes: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  image_url: z.string().trim().max(500).nullable().optional(),
  available_from: z.string().trim().max(120).nullable().optional(),
  is_active: z.boolean().default(true),
  sort: z.number().int().min(0).max(9999).default(0),
});

export const upsertMerchItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => upsertSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { id, ...values } = data;
    if (id) {
      const { error } = await supabase.from("merch_items").update(values).eq("id", id);
      if (error) throw error;
      return { id };
    }
    const { data: row, error } = await supabase
      .from("merch_items")
      .insert(values)
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id };
  });

export const deleteMerchItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await supabase.from("merch_items").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

const enquirySchema = z.object({
  itemId: z.string().min(1).max(64),
  itemName: z.string().min(1).max(120),
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(40).optional().default(""),
  size: z.string().trim().max(40).optional().default(""),
  quantity: z.coerce.number().int().min(1).max(50),
  notes: z.string().trim().max(1000).optional().default(""),
});

function esc(v: string) {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return v.replace(/[&<>"']/g, (c) => map[c] ?? c);
}

export const sendMerchEnquiry = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => enquirySchema.parse(input))
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
