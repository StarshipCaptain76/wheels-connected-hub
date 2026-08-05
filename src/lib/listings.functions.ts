import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type ListingCategory = "parts" | "cars" | "memorabilia" | "other";
export type ListingCondition = "new" | "used" | "project";
export type ListingStatus = "pending" | "approved" | "rejected" | "sold";

export type ListingContact = {
  contact_name: string;
  contact_phone: string | null;
  contact_email: string;
};

export type PublicListing = {
  id: string;
  user_id?: string;
  title: string;
  title_af: string | null;
  description: string;
  description_af: string | null;
  price_zar: number | null;
  category: ListingCategory;
  condition: ListingCondition;
  location: string | null;
  status: ListingStatus;
  created_at: string;
  contact?: ListingContact;
  photos: { id: string; url: string; sort: number }[];
};

export type MyListing = PublicListing;

const LISTING_SELECT =
  "id, user_id, title, title_af, description, description_af, price_zar, category, condition, location, status, created_at, listing_photos(id, image_url, sort)";

const LISTING_WITH_CONTACT_SELECT = `${LISTING_SELECT}, listing_contacts!inner(contact_name, contact_phone, contact_email)`;

type RawPhoto = { id: string; image_url: string; sort: number };
type RawListing = {
  id: string;
  user_id?: string;
  title: string;
  title_af: string | null;
  description: string;
  description_af: string | null;
  price_zar: number | null;
  category: ListingCategory;
  condition: ListingCondition;
  location: string | null;
  status: ListingStatus;
  created_at: string;
  listing_photos: RawPhoto[] | null;
  listing_contacts?: { contact_name: string; contact_phone: string | null; contact_email: string } | null;
};

async function signPhotos(
  client: {
    storage: {
      from: (b: string) => {
        createSignedUrls: (
          paths: string[],
          expires: number,
        ) => Promise<{ data: { path: string | null; signedUrl: string }[] | null; error: unknown }>;
      };
    };
  },
  photos: RawPhoto[],
): Promise<{ id: string; url: string; sort: number }[]> {
  if (photos.length === 0) return [];
  const paths = photos.map((p) => p.image_url);
  const { data, error } = await client.storage.from("listings").createSignedUrls(paths, 60 * 60 * 24 * 7);
  if (error) throw error;
  const map = new Map<string, string>();
  (data ?? []).forEach((d) => {
    if (d.path) map.set(d.path, d.signedUrl);
  });
  return photos
    .slice()
    .sort((a, b) => a.sort - b.sort)
    .map((p) => ({ id: p.id, url: map.get(p.image_url) ?? "", sort: p.sort }));
}

function mapListing(raw: RawListing): PublicListing {
  const contact = raw.listing_contacts;
  return {
    id: raw.id,
    user_id: raw.user_id,
    title: raw.title,
    title_af: raw.title_af,
    description: raw.description,
    description_af: raw.description_af,
    price_zar: raw.price_zar,
    category: raw.category,
    condition: raw.condition,
    location: raw.location,
    status: raw.status,
    created_at: raw.created_at,
    contact: contact
      ? {
          contact_name: contact.contact_name,
          contact_phone: contact.contact_phone,
          contact_email: contact.contact_email,
        }
      : undefined,
    photos: [],
    // @ts-expect-error placeholder
    _raw_photos: raw.listing_photos ?? [],
  };
}

const listInputSchema = z
  .object({
    category: z.enum(["parts", "cars", "memorabilia", "other"]).nullable().optional(),
    search: z.string().trim().max(120).nullable().optional(),
  })
  .optional();

export const listApprovedListings = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => listInputSchema.parse(input))
  .handler(async ({ data }): Promise<PublicListing[]> => {
    const { createPublicSupabase } = await import("./public-supabase.server");
    const supabase = createPublicSupabase();
    let q = supabase
      .from("listings")
      .select(LISTING_SELECT)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(60);
    if (data?.category) q = q.eq("category", data.category);
    if (data?.search) q = q.ilike("title", `%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const listings = (rows ?? []).map((r) => mapListing(r as RawListing));
    for (const l of listings) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      l.photos = await signPhotos(supabase as any, (l as any)._raw_photos);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (l as any)._raw_photos;
    }
    return listings as PublicListing[];
  });

export const getPublicListing = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<PublicListing | null> => {
    const { createPublicSupabase } = await import("./public-supabase.server");
    const supabase = createPublicSupabase();
    const { data: row, error } = await supabase
      .from("listings")
      .select(LISTING_SELECT)
      .eq("id", data.id)
      .eq("status", "approved")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    const l = mapListing(row as RawListing);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    l.photos = await signPhotos(supabase as any, (l as any)._raw_photos);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (l as any)._raw_photos;
    return l as PublicListing;
  });

export const getListing = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<PublicListing | null> => {
    const { supabase } = context;
    const SELECT_WITH_OPTIONAL_CONTACT = `${LISTING_SELECT}, listing_contacts(contact_name, contact_phone, contact_email)`;
    const { data: row, error } = await supabase
      .from("listings")
      .select(SELECT_WITH_OPTIONAL_CONTACT)
      .eq("id", data.id)
      .eq("status", "approved")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    const raw = row as RawListing & {
      listing_contacts?: RawListing["listing_contacts"] | RawListing["listing_contacts"][];
    };
    if (Array.isArray(raw.listing_contacts)) {
      raw.listing_contacts = raw.listing_contacts[0] ?? null;
    }
    const l = mapListing(raw as RawListing);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    l.photos = await signPhotos(supabase as any, (l as any)._raw_photos);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (l as any)._raw_photos;
    return l as PublicListing;
  });

export const listMyListings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyListing[]> => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("listings")
      .select(LISTING_WITH_CONTACT_SELECT)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const listings = (rows ?? []).map((r) => mapListing(r as RawListing));
    for (const l of listings) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      l.photos = await signPhotos(supabase as any, (l as any)._raw_photos);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (l as any)._raw_photos;
    }
    return listings as MyListing[];
  });

const createSchema = z.object({
  title: z.string().trim().min(3).max(120),
  title_af: z.string().trim().max(120).nullable().optional(),
  description: z.string().trim().min(10).max(4000),
  description_af: z.string().trim().max(4000).nullable().optional(),
  price_zar: z.number().nonnegative().max(99_999_999).nullable().optional(),
  category: z.enum(["parts", "cars", "memorabilia", "other"]),
  condition: z.enum(["new", "used", "project"]),
  location: z.string().trim().max(120).nullable().optional(),
  contact_name: z.string().trim().min(1).max(120),
  contact_phone: z.string().trim().max(40).nullable().optional(),
  contact_email: z.string().trim().email().max(200),
  photo_paths: z.array(z.string().min(1).max(300)).max(6).default([]),
});

export const createListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ context, data }): Promise<{ id: string }> => {
    const { supabase, userId } = context;
    const { photo_paths, contact_name, contact_phone, contact_email, ...listing } = data;
    const { data: row, error } = await supabase
      .from("listings")
      .insert({ ...listing, user_id: userId, status: "pending" as const })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const { error: cErr } = await supabase.from("listing_contacts").insert({
      listing_id: row.id,
      contact_name,
      contact_phone: contact_phone ?? null,
      contact_email,
    });
    if (cErr) throw new Error(cErr.message);
    if (photo_paths.length > 0) {
      const photos = photo_paths.map((p, i) => ({
        listing_id: row.id,
        image_url: p,
        sort: i,
      }));
      const { error: pErr } = await supabase.from("listing_photos").insert(photos);
      if (pErr) throw new Error(pErr.message);
    }
    try {
      const { fanOut } = await import("./notify.server");
      await fanOut({
        type: "admin_listing_review",
        title_en: "New listing awaiting approval",
        title_af: "Nuwe advertensie wag vir goedkeuring",
        body_en: listing.title,
        body_af: listing.title_af ?? listing.title,
        link: "/admin/classifieds",
        related_id: row.id as string,
        excludeUserId: userId,
      }, supabase);
    } catch (e) {
      console.error("[listings] admin notification failed", e);
    }

    return { id: row.id };
  });

/** Owner (or admin via RLS) permanently deletes their listing */
export const deleteListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    // Verify ownership first for a clear error (RLS would otherwise silently no-op)
    const { data: row, error: findErr } = await supabase
      .from("listings")
      .select("id, user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (findErr) throw new Error(findErr.message);
    if (!row) throw new Error("Listing not found");
    if (row.user_id !== userId) {
      // Admins can still delete via their policy if present
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });
      if (!isAdmin) throw new Error("You can only delete your own listings");
    }

    const { error, count } = await supabase
      .from("listings")
      .delete({ count: "exact" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    if (count === 0) {
      throw new Error(
        "Delete blocked by security policy. Ask an admin to check listings_owner_delete RLS.",
      );
    }
    return { ok: true };
  });

/** Owner delists / marks sold — removes from public marketplace */
export const markSold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const { data: row, error: findErr } = await supabase
      .from("listings")
      .select("id, user_id, status")
      .eq("id", data.id)
      .maybeSingle();
    if (findErr) throw new Error(findErr.message);
    if (!row) throw new Error("Listing not found");
    if (row.user_id !== userId) {
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });
      if (!isAdmin) throw new Error("You can only delist your own listings");
    }

    const { data: updated, error } = await supabase
      .from("listings")
      .update({ status: "sold" as const })
      .eq("id", data.id)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) {
      throw new Error(
        "Delist blocked by security policy. Owners may only set status to sold — check listings_owner_update RLS.",
      );
    }
    return { ok: true };
  });

// ── Admin ────────────────────────────────────────────────────────────

export const listPendingListings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyListing[]> => {
    const { supabase, userId } = context;
    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(`Role check failed: ${roleErr.message}`);
    if (!isAdmin) throw new Error("Forbidden");

    let rows: unknown[] | null = null;
    let client: typeof supabase = supabase;
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      client = supabaseAdmin as typeof supabase;
      const res = await supabaseAdmin
        .from("listings")
        .select(LISTING_WITH_CONTACT_SELECT)
        .in("status", ["pending", "approved", "rejected"])
        .order("created_at", { ascending: false })
        .limit(100);
      if (res.error) throw res.error;
      rows = res.data;
    } catch (e) {
      console.error("[admin listings] service role list failed, falling back", e);
      const res = await supabase
        .from("listings")
        .select(LISTING_WITH_CONTACT_SELECT)
        .in("status", ["pending", "approved", "rejected"])
        .order("created_at", { ascending: false })
        .limit(100);
      if (res.error) throw res.error;
      rows = res.data;
    }

    const listings = (rows ?? []).map((r) => mapListing(r as RawListing));

    listings.sort((a, b) => {
      const rank = (s: string) => (s === "pending" ? 0 : s === "approved" ? 1 : 2);
      const d = rank(a.status) - rank(b.status);
      if (d !== 0) return d;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    for (const l of listings) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      l.photos = await signPhotos(client as any, (l as any)._raw_photos);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (l as any)._raw_photos;
    }
    return listings as MyListing[];
  });

export const moderateListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["approved", "rejected", "pending"]),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(`Role check failed: ${roleErr.message}`);
    if (!isAdmin) throw new Error("Forbidden");

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin
        .from("listings")
        .update({ status: data.status })
        .eq("id", data.id);
      if (error) throw error;
    } catch (e) {
      const { error } = await supabase
        .from("listings")
        .update({ status: data.status })
        .eq("id", data.id);
      if (error) throw new Error(`Could not update listing: ${error.message}`);
      if (e instanceof Error) console.error("[admin listings] service role moderate failed", e);
    }

    if (data.status === "approved") {
      try {
        const { data: row } = await supabase
          .from("listings")
          .select("title, title_af, user_id")
          .eq("id", data.id)
          .maybeSingle();
        const { fanOut } = await import("./notify.server");
        await fanOut({
          type: "new_listing",
          title_en: "New listing in the classifieds",
          title_af: "Nuwe advertensie in die markplek",
          body_en: (row?.title as string) ?? null,
          body_af: ((row?.title_af as string | null) ?? (row?.title as string)) ?? null,
          link: `/classifieds/${data.id}`,
          related_id: data.id,
          excludeUserId: (row?.user_id as string | null) ?? null,
        }, supabase);
      } catch (e) {
        console.error("[listings] member notification failed", e);
      }
    }
    return { ok: true };
  });

