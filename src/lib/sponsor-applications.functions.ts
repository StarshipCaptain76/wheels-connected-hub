import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type SponsorApplication = {
  id: string;
  business: string;
  contact_name: string;
  email: string;
  phone: string | null;
  website: string | null;
  message: string | null;
  status: "pending" | "approved" | "declined";
  created_at: string;
  reviewed_at: string | null;
  created_sponsor_id: string | null;
};

async function assertAdmin(supabase: { rpc: Function }, userId: string) {
  const { data: isAdmin, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(`Role check failed: ${error.message}`);
  if (!isAdmin) throw new Error("Forbidden");
}

export const listSponsorApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SponsorApplication[]> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data, error } = await supabase
      .from("sponsor_applications")
      .select(
        "id, business, contact_name, email, phone, website, message, status, created_at, reviewed_at, created_sponsor_id",
      )
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id as string,
      business: r.business as string,
      contact_name: r.contact_name as string,
      email: r.email as string,
      phone: (r.phone as string | null) ?? null,
      website: (r.website as string | null) ?? null,
      message: (r.message as string | null) ?? null,
      status: (r.status as SponsorApplication["status"]) ?? "pending",
      created_at: r.created_at as string,
      reviewed_at: (r.reviewed_at as string | null) ?? null,
      created_sponsor_id: (r.created_sponsor_id as string | null) ?? null,
    }));
  });

const approveSchema = z.object({
  id: z.string().uuid(),
  owner_user_id: z.string().uuid(),
  billing_starts_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  billing_ends_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const PLACEHOLDER_LOGO = "https://www.justwheels.co.za/icon-512.png";

export const approveSponsorApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => approveSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { data: app, error: appErr } = await supabase
      .from("sponsor_applications")
      .select("id, business, contact_name, email, website, status, created_sponsor_id")
      .eq("id", data.id)
      .single();
    if (appErr) throw appErr;
    if (app.status === "approved" && app.created_sponsor_id) {
      throw new Error("This application has already been approved");
    }

    const { data: sponsor, error: insErr } = await supabase
      .from("sponsors")
      .insert({
        name: app.business as string,
        website_url: (app.website as string | null) || null,
        logo_path: PLACEHOLDER_LOGO,
        is_active: false,
        sort: 100,
        owner_user_id: data.owner_user_id,
        billing_starts_at: data.billing_starts_at,
        billing_ends_at: data.billing_ends_at,
      })
      .select("id")
      .single();
    if (insErr) throw insErr;

    const { error: updErr } = await supabase
      .from("sponsor_applications")
      .update({
        status: "approved",
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        created_sponsor_id: sponsor.id as string,
      })
      .eq("id", data.id);
    if (updErr) throw updErr;

    // Notify applicant + assigned member
    const { escapeHtml, emailShell, sendEmail, SITE_ORIGIN } = await import("./email.server");
    const recipients = new Set<string>([String(app.email)]);
    try {
      const { data: owner } = await context.supabase
        .from("member_emails")
        .select("email")
        .eq("user_id", data.owner_user_id)
        .maybeSingle();
      if (owner?.email) recipients.add(owner.email as string);
    } catch (e) {
      console.error("[sponsors] could not resolve owner email", e);
    }

    try {
      await sendEmail({
        to: [...recipients],
        subject: "Sponsorship approved — complete your sponsor card",
        html: emailShell(
          "Your sponsorship is approved",
          '<p style="margin:0 0 12px">Great news — <strong>' +
            escapeHtml(String(app.business)) +
            "</strong> has been approved as a Just Wheels Hessequa sponsor.</p>" +
            '<p style="margin:0 0 12px">Sponsorship period: <strong>' +
            escapeHtml(data.billing_starts_at) +
            "</strong> to <strong>" +
            escapeHtml(data.billing_ends_at) +
            "</strong>.</p>" +
            '<p style="margin:0 0 12px">Please sign in and complete your sponsor card (logo, tagline and website):</p>' +
            '<p style="margin:0 0 16px"><a href="' +
            SITE_ORIGIN +
            '/members/sponsor" style="display:inline-block;background:#c0392b;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Complete sponsor card</a></p>' +
            '<p style="margin:0;color:#555">Your card goes live once the club admin activates it.</p>',
        ),
      });
    } catch (e) {
      console.error("[sponsors] approval email failed", e);
    }

    return { ok: true as const, sponsorId: sponsor.id as string };
  });

export const declineSponsorApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase
      .from("sponsor_applications")
      .update({ status: "declined", reviewed_by: userId, reviewed_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true as const };
  });

export const deleteSponsorApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase.from("sponsor_applications").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true as const };
  });
