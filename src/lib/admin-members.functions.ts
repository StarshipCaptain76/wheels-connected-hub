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

async function assertAdmin(supabase: { rpc: Function }, userId: string) {
  const { data: isAdmin, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(`Role check failed: ${error.message}`);
  if (!isAdmin) throw new Error("Forbidden");
}

async function getAdminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const listAllMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminMember[]> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    // Prefer service role so RLS never hides rows from admin
    let profiles: Array<Record<string, unknown>> = [];
    let adminRows: Array<{ user_id: string }> = [];
    try {
      const admin = await getAdminClient();
      const { data, error } = await admin
        .from("profiles")
        .select(
          "id, display_name, phone, town, favourite_ride, member_number, membership_status, joined_at, is_featured",
        )
        .order("member_number", { ascending: true });
      if (error) throw error;
      profiles = (data ?? []) as Array<Record<string, unknown>>;

      const { data: roles } = await admin.from("user_roles").select("user_id").eq("role", "admin");
      adminRows = (roles ?? []) as Array<{ user_id: string }>;
    } catch (e) {
      // Fall back to user-scoped client
      console.error("[admin members] service role list failed, falling back", e);
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, display_name, phone, town, favourite_ride, member_number, membership_status, joined_at, is_featured",
        )
        .order("member_number", { ascending: true });
      if (error) throw new Error(`Could not load members: ${error.message}`);
      profiles = (data ?? []) as Array<Record<string, unknown>>;
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      adminRows = (roles ?? []) as Array<{ user_id: string }>;
    }

    const adminSet = new Set(adminRows.map((r) => r.user_id));

    const emailById = new Map<string, string | null>();
    try {
      const admin = await getAdminClient();
      const { data: usersPage, error: usersErr } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      if (usersErr) console.error("[admin members] listUsers", usersErr);
      else for (const u of usersPage?.users ?? []) emailById.set(u.id, u.email ?? null);
    } catch (e) {
      console.error("[admin members] email lookup skipped", e);
    }

    return profiles.map((p) => ({
      user_id: String(p.id),
      display_name: (p.display_name as string | null) ?? null,
      email: emailById.get(String(p.id)) ?? null,
      phone: (p.phone as string | null) ?? null,
      town: (p.town as string | null) ?? null,
      favourite_ride: (p.favourite_ride as string | null) ?? null,
      member_number: Number(p.member_number ?? 0),
      membership_status: String(p.membership_status ?? "pending"),
      joined_at: String(p.joined_at ?? ""),
      is_admin: adminSet.has(String(p.id)),
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
    await assertAdmin(context.supabase, context.userId);

    // Service role bypasses profiles RLS so status changes always stick
    try {
      const admin = await getAdminClient();
      const { error } = await admin
        .from("profiles")
        .update({ membership_status: data.status })
        .eq("id", data.userId);
      if (error) throw error;
    } catch (e) {
      // Fallback to user client (needs admin RLS policy)
      const { error } = await context.supabase
        .from("profiles")
        .update({ membership_status: data.status })
        .eq("id", data.userId);
      if (error) throw new Error(`Could not update status: ${error.message}`);
      if (e instanceof Error && !String(e.message).includes("membership")) {
        console.error("[admin members] service role update failed", e);
      }
    }
    return { ok: true };
  });

export const setAdminRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ userId: z.string().uuid(), isAdmin: z.boolean() }).parse(i),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId && !data.isAdmin) {
      throw new Error("You cannot remove your own admin role.");
    }

    const client = await getAdminClient().catch(() => context.supabase);

    if (data.isAdmin) {
      const { error } = await client
        .from("user_roles")
        .insert({ user_id: data.userId, role: "admin" });
      if (error && !String(error.message).toLowerCase().includes("duplicate")) throw error;
    } else {
      const { error } = await client
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
    await assertAdmin(context.supabase, context.userId);
    const client = await getAdminClient().catch(() => context.supabase);

    const { error: clearErr } = await client
      .from("profiles")
      .update({ is_featured: false })
      .eq("is_featured", true);
    if (clearErr) throw clearErr;

    if (data.userId) {
      const { error } = await client
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
