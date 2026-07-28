import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type AdminMember = {
  user_id: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  town: string | null;
  favourite_ride: string | null;
  member_number: number;
  membership_status: string;
  joined_at: string;
  is_admin: boolean;
  is_featured: boolean;
};

export const listAllMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminMember[]> => {
    const { supabase, userId } = context;

    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr) {
      console.error("[admin members] has_role", roleErr);
      throw new Error(`Role check failed: ${roleErr.message}`);
    }
    if (!isAdmin) throw new Error("Forbidden");

    const { data: profiles, error } = await supabase
      .from("profiles")
      .select(
        "id, display_name, phone, town, favourite_ride, member_number, membership_status, joined_at, is_featured",
      )
      .order("member_number", { ascending: true });
    if (error) {
      console.error("[admin members] profiles", error);
      throw new Error(`Could not load members: ${error.message}`);
    }

    const { data: adminRows, error: rolesErr } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    if (rolesErr) {
      console.error("[admin members] user_roles", rolesErr);
    }
    const adminSet = new Set((adminRows ?? []).map((r: { user_id: string }) => r.user_id));

    // Emails via service-role admin API — optional (page still works without them)
    const emailById = new Map<string, string | null>();
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: usersPage, error: usersErr } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      if (usersErr) {
        console.error("[admin members] listUsers", usersErr);
      } else {
        for (const u of usersPage?.users ?? []) {
          emailById.set(u.id, u.email ?? null);
        }
      }
    } catch (e) {
      // Missing SUPABASE_SERVICE_ROLE_KEY or other admin-API failure must not blank the page
      console.error("[admin members] email lookup skipped", e);
    }

    return (profiles ?? []).map((p) => ({
      user_id: p.id as string,
      display_name: p.display_name as string | null,
      email: emailById.get(p.id as string) ?? null,
      phone: p.phone as string | null,
      town: p.town as string | null,
      favourite_ride: p.favourite_ride as string | null,
      member_number: Number(p.member_number),
      membership_status: String(p.membership_status ?? "pending"),
      joined_at: String(p.joined_at ?? ""),
      is_admin: adminSet.has(p.id as string),
      is_featured: Boolean(p.is_featured),
    }));
  });

export const updateMemberStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        status: z.enum(["pending", "active", "suspended"]),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await supabase
      .from("profiles")
      .update({ membership_status: data.status })
      .eq("id", data.userId);
    if (error) throw error;
    return { ok: true };
  });

export const setAdminRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ userId: z.string().uuid(), isAdmin: z.boolean() }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    if (data.userId === userId && !data.isAdmin) {
      throw new Error("You cannot remove your own admin role.");
    }

    if (data.isAdmin) {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: data.userId, role: "admin" });
      if (error && !String(error.message).toLowerCase().includes("duplicate")) throw error;
    } else {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", "admin");
      if (error) throw error;
    }
    return { ok: true };
  });

export const setFeaturedMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        userId: z.string().uuid().nullable(),
        bio: z.string().trim().max(600).nullable().optional(),
        photoUrl: z.string().trim().max(1000).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { error: clearErr } = await supabase
      .from("profiles")
      .update({ is_featured: false })
      .eq("is_featured", true);
    if (clearErr) throw clearErr;

    if (data.userId) {
      const { error } = await supabase
        .from("profiles")
        .update({
          is_featured: true,
          featured_bio: data.bio ?? null,
          featured_photo_url: data.photoUrl ?? null,
          featured_since: new Date().toISOString(),
        })
        .eq("id", data.userId);
      if (error) throw error;
    }
    return { ok: true };
  });
