import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyClient = {
  from: (t: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => any;
  auth?: any;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

export type MemberFeaturePhoto = {
  id: string;
  url: string;
  caption_en: string | null;
  caption_af: string | null;
  sort_order: number;
};

export type MemberFeature = {
  id: string;
  member_user_id: string;
  slug: string | null;
  headline_en: string;
  headline_af: string | null;
  deck_en: string | null;
  deck_af: string | null;
  body_en: string;
  body_af: string | null;
  cover_url: string | null;
  published: boolean;
  show_on_home: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  member_display_name: string | null;
  member_number: number;
  member_town: string | null;
  member_favourite_ride: string | null;
  photos: MemberFeaturePhoto[];
};

export type MemberFeatureHomeCard = {
  slug: string;
  headline_en: string;
  headline_af: string | null;
  deck_en: string | null;
  deck_af: string | null;
  cover_url: string | null;
  member_display_name: string | null;
  member_number: number;
  published_at: string | null;
};

const FEATURE_SELECT =
  "id, member_user_id, slug, headline_en, headline_af, deck_en, deck_af, body_en, body_af, cover_url, published, show_on_home, published_at, created_at, updated_at";

async function assertAdmin(supabase: AnyClient, userId: string) {
  const { data: isAdmin, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(`Role check failed: ${error.message}`);
  if (!isAdmin) throw new Error("Forbidden");
}

async function maybeAuthed(): Promise<{ supabase: AnyClient; userId: string } | null> {
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    const authHeader = request?.headers?.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return null;
    const token = authHeader.slice(7);
    if (!token || token.split(".").length !== 3) return null;
    const { createClient } = await import("@supabase/supabase-js");
    const url =
      process.env.SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      import.meta.env?.VITE_SUPABASE_URL;
    const key =
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return null;
    const supabase = createClient(url, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    }) as unknown as AnyClient;
    const { data } = await supabase.auth.getUser(token);
    const userId = data?.user?.id as string | undefined;
    if (!userId) return null;
    return { supabase, userId };
  } catch {
    return null;
  }
}

export function slugFromHeadline(headlineEn: string, id: string): string {
  const short = id.replace(/-/g, "").slice(0, 8);
  const base =
    headlineEn
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "member";
  return `${base}-${short}`;
}

async function signUrls(sb: AnyClient, urls: (string | null | undefined)[]) {
  const { signStoredUrls } = await import("./storage-urls.server");
  return signStoredUrls(sb, urls);
}

async function loadPhotos(sb: AnyClient, featureId: string): Promise<MemberFeaturePhoto[]> {
  const { data, error } = await sb
    .from("member_feature_photos")
    .select("id, url, caption_en, caption_af, sort_order")
    .eq("feature_id", featureId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as MemberFeaturePhoto[]).map((p) => ({
    id: p.id,
    url: p.url,
    caption_en: p.caption_en ?? null,
    caption_af: p.caption_af ?? null,
    sort_order: Number(p.sort_order) || 0,
  }));
}

async function loadMember(
  sb: AnyClient,
  userId: string,
): Promise<{
  display_name: string | null;
  member_number: number;
  town: string | null;
  favourite_ride: string | null;
}> {
  const { data } = await sb
    .from("profiles")
    .select("display_name, member_number, town, favourite_ride")
    .eq("id", userId)
    .maybeSingle();
  return {
    display_name: (data?.display_name as string | null) ?? null,
    member_number: Number(data?.member_number ?? 0),
    town: (data?.town as string | null) ?? null,
    favourite_ride: (data?.favourite_ride as string | null) ?? null,
  };
}

async function hydrate(
  sb: AnyClient,
  row: Record<string, unknown>,
): Promise<MemberFeature> {
  const member = await loadMember(sb, String(row.member_user_id));
  const photos = await loadPhotos(sb, String(row.id));
  const signed = await signUrls(sb, [row.cover_url as string | null, ...photos.map((p) => p.url)]);
  return {
    id: String(row.id),
    member_user_id: String(row.member_user_id),
    slug: (row.slug as string | null) ?? null,
    headline_en: String(row.headline_en ?? ""),
    headline_af: (row.headline_af as string | null) ?? null,
    deck_en: (row.deck_en as string | null) ?? null,
    deck_af: (row.deck_af as string | null) ?? null,
    body_en: String(row.body_en ?? ""),
    body_af: (row.body_af as string | null) ?? null,
    cover_url: signed.get(String(row.cover_url ?? "")) ?? ((row.cover_url as string | null) ?? null),
    published: Boolean(row.published),
    show_on_home: Boolean(row.show_on_home),
    published_at: (row.published_at as string | null) ?? null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
    member_display_name: member.display_name,
    member_number: member.member_number,
    member_town: member.town,
    member_favourite_ride: member.favourite_ride,
    photos: photos.map((p) => ({ ...p, url: signed.get(p.url) ?? p.url })),
  };
}

/** Persist the stable public-format storage URL, never a signed token. */
function toStoredUrl(url: string | null | undefined): string | null {
  const t = (url ?? "").trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    u.search = "";
    u.hash = "";
    u.pathname = u.pathname
      .replace("/object/sign/", "/object/public/")
      .replace("/object/authenticated/", "/object/public/");
    return `${u.origin}${u.pathname}`;
  } catch {
    return t;
  }
}

function assertPublishable(row: { cover_url: string | null; headline_en: string }) {
  if (!row.headline_en.trim()) throw new Error("Headline (EN) is required to publish.");
  if (!row.cover_url) throw new Error("A cover photo is required to publish.");
}

async function markMemberFeatured(sb: AnyClient, memberUserId: string) {
  const { error } = await sb
    .from("profiles")
    .update({
      is_featured: true,
      featured_since: new Date().toISOString(),
    })
    .eq("id", memberUserId);
  if (error) throw new Error(error.message);
}

async function applyHome(sb: AnyClient, featureId: string, on: boolean) {
  if (on) {
    const { data: row, error: loadErr } = await sb
      .from("member_features")
      .select("id, cover_url, headline_en, member_user_id, slug, published, published_at")
      .eq("id", featureId)
      .maybeSingle();
    if (loadErr) throw new Error(loadErr.message);
    if (!row) throw new Error("Feature not found");
    assertPublishable(row);
    const slug = (row.slug as string | null) ?? slugFromHeadline(String(row.headline_en), String(row.id));
    const { error: clearErr } = await sb
      .from("member_features")
      .update({ show_on_home: false, updated_at: new Date().toISOString() })
      .eq("show_on_home", true)
      .neq("id", featureId);
    if (clearErr) throw new Error(clearErr.message);
    const { error } = await sb
      .from("member_features")
      .update({
        show_on_home: true,
        published: true,
        slug,
        published_at: row.published_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", featureId);
    if (error) throw new Error(error.message);
    await markMemberFeatured(sb, String(row.member_user_id));
  } else {
    const { error } = await sb
      .from("member_features")
      .update({ show_on_home: false, updated_at: new Date().toISOString() })
      .eq("id", featureId);
    if (error) throw new Error(error.message);
  }
}

export const getHomeMemberFeature = createServerFn({ method: "GET" }).handler(
  async (): Promise<MemberFeatureHomeCard | null> => {
    try {
      const { createPublicSupabase } = await import("./public-supabase.server");
      const { elevated } = await import("./elevated.server");
      const anon = createPublicSupabase() as unknown as AnyClient;
      const sb = (await elevated(anon)) as AnyClient;
      const { data, error } = await sb
        .from("member_features")
        .select(
          "slug, headline_en, headline_af, deck_en, deck_af, cover_url, published_at, member_user_id",
        )
        .eq("show_on_home", true)
        .eq("published", true)
        .maybeSingle();
      if (error || !data?.slug) return null;
      const member = await loadMember(sb, String(data.member_user_id));
      const cover = await signUrls(sb, [data.cover_url as string | null]);
      return {
        slug: String(data.slug),
        headline_en: String(data.headline_en ?? ""),
        headline_af: (data.headline_af as string | null) ?? null,
        deck_en: (data.deck_en as string | null) ?? null,
        deck_af: (data.deck_af as string | null) ?? null,
        cover_url: cover.get(String(data.cover_url ?? "")) ?? ((data.cover_url as string | null) ?? null),
        member_display_name: member.display_name,
        member_number: member.member_number,
        published_at: (data.published_at as string | null) ?? null,
      };
    } catch (e) {
      console.error("[member-features] home card failed (site continues)", e);
      return null;
    }
  },
);

export const getMemberFeatureBySlug = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ slug: z.string().min(1).max(80) }).parse(i))
  .handler(async ({ data }): Promise<MemberFeature | null> => {
    const { createPublicSupabase } = await import("./public-supabase.server");
    const { elevated } = await import("./elevated.server");
    const authed = await maybeAuthed();
    const anon = createPublicSupabase() as unknown as AnyClient;
    const sb = (await elevated(authed?.supabase ?? anon)) as AnyClient;

    const { data: row, error } = await sb
      .from("member_features")
      .select(FEATURE_SELECT)
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) {
      console.error("[member-features] getBySlug", error.message);
      return null;
    }
    if (!row) return null;

    if (!row.published) {
      if (!authed) return null;
      const { data: isAdmin } = await authed.supabase.rpc("has_role", {
        _user_id: authed.userId,
        _role: "admin",
      });
      if (!isAdmin) return null;
    }

    return hydrate(sb, row as Record<string, unknown>);
  });

export const adminListMemberFeatures = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MemberFeature[]> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase as unknown as AnyClient, userId);
    const { elevated } = await import("./elevated.server");
    const sb = (await elevated(supabase)) as AnyClient;
    const { data, error } = await sb
      .from("member_features")
      .select(FEATURE_SELECT)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const out: MemberFeature[] = [];
    for (const row of rows) out.push(await hydrate(sb, row));
    return out;
  });

export const adminGetMemberFeature = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }): Promise<MemberFeature> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase as unknown as AnyClient, userId);
    const { elevated } = await import("./elevated.server");
    const sb = (await elevated(supabase)) as AnyClient;
    const { data: row, error } = await sb
      .from("member_features")
      .select(FEATURE_SELECT)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Feature not found");
    return hydrate(sb, row as Record<string, unknown>);
  });

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  memberUserId: z.string().uuid(),
  headlineEn: z.string().max(160),
  headlineAf: z.string().max(160).nullable().optional(),
  deckEn: z.string().max(400).nullable().optional(),
  deckAf: z.string().max(400).nullable().optional(),
  bodyEn: z.string().max(8000),
  bodyAf: z.string().max(8000).nullable().optional(),
  coverUrl: z.string().max(2000).nullable().optional(),
  published: z.boolean().optional(),
  showOnHome: z.boolean().optional(),
});

export const adminUpsertMemberFeature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => upsertSchema.parse(i))
  .handler(async ({ context, data }): Promise<MemberFeature> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase as unknown as AnyClient, userId);
    const { elevated } = await import("./elevated.server");
    const sb = (await elevated(supabase)) as AnyClient;
    const now = new Date().toISOString();

    const blank = (v: string | null | undefined) => {
      const t = (v ?? "").trim();
      return t.length ? t : null;
    };

    if (data.id) {
      const { data: existing, error: loadErr } = await sb
        .from("member_features")
        .select(FEATURE_SELECT)
        .eq("id", data.id)
        .maybeSingle();
      if (loadErr) throw new Error(loadErr.message);
      if (!existing) throw new Error("Feature not found");

      const published = data.published ?? Boolean(existing.published);
      const showOnHome = data.showOnHome ?? Boolean(existing.show_on_home);
      const coverUrl =
        data.coverUrl === undefined
          ? (existing.cover_url as string | null)
          : toStoredUrl(data.coverUrl);
      const headlineEn = data.headlineEn;
      if (published || showOnHome) assertPublishable({ cover_url: coverUrl ?? null, headline_en: headlineEn });

      // Slug is assigned once (first save) and never rewritten after that.
      const slug =
        (existing.slug as string | null) ?? slugFromHeadline(headlineEn || "member", String(existing.id));

      const { error } = await sb
        .from("member_features")
        .update({
          member_user_id: data.memberUserId,
          headline_en: headlineEn,
          headline_af: blank(data.headlineAf),
          deck_en: blank(data.deckEn),
          deck_af: blank(data.deckAf),
          body_en: data.bodyEn,
          body_af: blank(data.bodyAf),
          cover_url: coverUrl || null,
          slug,
          published,
          published_at: published
            ? ((existing.published_at as string | null) ?? now)
            : (existing.published_at as string | null),
          updated_at: now,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);

      if (showOnHome) await applyHome(sb, data.id, true);
      else if (existing.show_on_home && !showOnHome) await applyHome(sb, data.id, false);

      const { data: row } = await sb.from("member_features").select(FEATURE_SELECT).eq("id", data.id).single();
      return hydrate(sb, row as Record<string, unknown>);
    }

    const { data: inserted, error: insErr } = await sb
      .from("member_features")
      .insert({
        member_user_id: data.memberUserId,
        headline_en: data.headlineEn,
        headline_af: blank(data.headlineAf),
        deck_en: blank(data.deckEn),
        deck_af: blank(data.deckAf),
        body_en: data.bodyEn,
        body_af: blank(data.bodyAf),
        cover_url: toStoredUrl(data.coverUrl),
        published: false,
        show_on_home: false,
        created_by: userId,
        updated_at: now,
      })
      .select(FEATURE_SELECT)
      .single();
    if (insErr) throw new Error(insErr.message);

    const slug = slugFromHeadline(String(inserted.headline_en || "member"), String(inserted.id));
    const { error: slugErr } = await sb
      .from("member_features")
      .update({ slug, updated_at: now })
      .eq("id", inserted.id);
    if (slugErr) throw new Error(slugErr.message);

    const wantPublic = Boolean(data.published || data.showOnHome);
    if (wantPublic) {
      assertPublishable({
        cover_url: (inserted.cover_url as string | null) ?? null,
        headline_en: String(inserted.headline_en ?? ""),
      });
      const { error } = await sb
        .from("member_features")
        .update({
          published: true,
          published_at: now,
          updated_at: now,
        })
        .eq("id", inserted.id);
      if (error) throw new Error(error.message);
      if (data.showOnHome) await applyHome(sb, String(inserted.id), true);
    }

    const { data: row } = await sb
      .from("member_features")
      .select(FEATURE_SELECT)
      .eq("id", inserted.id)
      .single();
    return hydrate(sb, row as Record<string, unknown>);
  });

export const adminSetMemberFeaturePublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), published: z.boolean() }).parse(i),
  )
  .handler(async ({ context, data }): Promise<MemberFeature> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase as unknown as AnyClient, userId);
    const { elevated } = await import("./elevated.server");
    const sb = (await elevated(supabase)) as AnyClient;
    const { data: row, error: loadErr } = await sb
      .from("member_features")
      .select(FEATURE_SELECT)
      .eq("id", data.id)
      .maybeSingle();
    if (loadErr) throw new Error(loadErr.message);
    if (!row) throw new Error("Feature not found");

    if (data.published) {
      assertPublishable({
        cover_url: (row.cover_url as string | null) ?? null,
        headline_en: String(row.headline_en ?? ""),
      });
    }

    const slug =
      (row.slug as string | null) ??
      (data.published ? slugFromHeadline(String(row.headline_en), String(row.id)) : null);
    const now = new Date().toISOString();
    const { error } = await sb
      .from("member_features")
      .update({
        published: data.published,
        slug,
        published_at: data.published ? ((row.published_at as string | null) ?? now) : row.published_at,
        show_on_home: data.published ? row.show_on_home : false,
        updated_at: now,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    const { data: updated } = await sb.from("member_features").select(FEATURE_SELECT).eq("id", data.id).single();
    return hydrate(sb, updated as Record<string, unknown>);
  });

export const adminSetMemberFeatureHome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), showOnHome: z.boolean() }).parse(i),
  )
  .handler(async ({ context, data }): Promise<MemberFeature> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase as unknown as AnyClient, userId);
    const { elevated } = await import("./elevated.server");
    const sb = (await elevated(supabase)) as AnyClient;
    await applyHome(sb, data.id, data.showOnHome);
    const { data: row } = await sb.from("member_features").select(FEATURE_SELECT).eq("id", data.id).single();
    return hydrate(sb, row as Record<string, unknown>);
  });

export const adminAddMemberFeaturePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        featureId: z.string().uuid(),
        url: z.string().min(1).max(2000),
        captionEn: z.string().max(200).nullable().optional(),
        captionAf: z.string().max(200).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }): Promise<MemberFeaturePhoto> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase as unknown as AnyClient, userId);
    const { elevated } = await import("./elevated.server");
    const sb = (await elevated(supabase)) as AnyClient;
    const existing = await loadPhotos(sb, data.featureId);
    if (existing.length >= 8) throw new Error("Maximum of 8 extra photos.");
    const sort = existing.length === 0 ? 0 : Math.max(...existing.map((p) => p.sort_order)) + 1;
    const { data: row, error } = await sb
      .from("member_feature_photos")
      .insert({
        feature_id: data.featureId,
        url: toStoredUrl(data.url) ?? data.url,
        caption_en: data.captionEn?.trim() || null,
        caption_af: data.captionAf?.trim() || null,
        sort_order: sort,
      })
      .select("id, url, caption_en, caption_af, sort_order")
      .single();
    if (error) throw new Error(error.message);
    const signed = await signUrls(sb, [row.url as string]);
    return {
      id: String(row.id),
      url: signed.get(String(row.url)) ?? String(row.url),
      caption_en: (row.caption_en as string | null) ?? null,
      caption_af: (row.caption_af as string | null) ?? null,
      sort_order: Number(row.sort_order) || 0,
    };
  });

export const adminRemoveMemberFeaturePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ photoId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase as unknown as AnyClient, userId);
    const { elevated } = await import("./elevated.server");
    const sb = (await elevated(supabase)) as AnyClient;
    const { error } = await sb.from("member_feature_photos").delete().eq("id", data.photoId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminReorderMemberFeaturePhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ featureId: z.string().uuid(), orderedIds: z.array(z.string().uuid()).max(8) }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase as unknown as AnyClient, userId);
    const { elevated } = await import("./elevated.server");
    const sb = (await elevated(supabase)) as AnyClient;
    for (let i = 0; i < data.orderedIds.length; i++) {
      const { error } = await sb
        .from("member_feature_photos")
        .update({ sort_order: i })
        .eq("id", data.orderedIds[i])
        .eq("feature_id", data.featureId);
      if (error) throw new Error(error.message);
    }
    return { ok: true as const };
  });
