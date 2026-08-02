import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type PhotoTag = {
  id: string;
  gallery_item_id: string;
  tagged_user_id: string;
  tagged_by: string;
  display_name: string | null;
  member_number: number | null;
  avatar_url: string | null;
};

export type TaggedPhoto = {
  id: string;
  image_url: string;
  title: string | null;
  caption: string | null;
  category: string | null;
  taken_at: string | null;
};

/** All tags on a photo (signed-in members only). */
export const listTagsForPhoto = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ galleryItemId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }): Promise<PhotoTag[]> => {
    const { supabase } = context;
    const { profilesByIds } = await import("./gallery-tags.server");
    const { data: tags, error } = await supabase
      .from("gallery_tags")
      .select("id, gallery_item_id, tagged_user_id, tagged_by, created_at")
      .eq("gallery_item_id", data.galleryItemId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    const rows = tags ?? [];
    const profiles = await profilesByIds(rows.map((r) => r.tagged_user_id as string));
    return rows.map((r) => {
      const p = profiles.get(r.tagged_user_id as string);
      return {
        id: r.id as string,
        gallery_item_id: r.gallery_item_id as string,
        tagged_user_id: r.tagged_user_id as string,
        tagged_by: r.tagged_by as string,
        display_name: p?.display_name ?? null,
        member_number: p?.member_number ?? null,
        avatar_url: p?.avatar_url ?? null,
      };
    });
  });

/** Published photos a member is tagged in — powers the profile carousel. */
export const listTaggedPhotosForUser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }): Promise<TaggedPhoto[]> => {
    const { supabase } = context;
    const { signStoredUrls } = await import("./storage-urls.server");
    const { data: tags, error } = await supabase
      .from("gallery_tags")
      .select("gallery_item_id")
      .eq("tagged_user_id", data.userId);
    if (error) throw error;
    const ids = [...new Set((tags ?? []).map((t) => t.gallery_item_id as string))];
    if (ids.length === 0) return [];
    const { data: items } = await supabase
      .from("gallery_items")
      .select("id, image_url, title, caption, category, taken_at, created_at")
      .in("id", ids)
      .eq("is_published", true)
      .order("created_at", { ascending: false });
    const signed = await signStoredUrls(
      supabase,
      (items ?? []).map((it) => it.image_url as string),
    );
    return (items ?? []).map((it) => ({
      id: it.id as string,
      image_url: signed.get(it.image_url as string) ?? (it.image_url as string),
      title: (it.title as string) ?? null,
      caption: (it.caption as string) ?? null,
      category: (it.category as string) ?? null,
      taken_at: (it.taken_at as string) ?? null,
    }));
  });


export const addPhotoTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({ galleryItemId: z.string().uuid(), taggedUserId: z.string().uuid() })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("gallery_tags").insert({
      gallery_item_id: data.galleryItemId,
      tagged_user_id: data.taggedUserId,
      tagged_by: userId,
    });
    if (error && !error.message.includes("duplicate")) throw error;

    if (data.taggedUserId !== userId) {
      const { notifyTagged, profileEmail } = await import("./gallery-tags.server");
      const me = await profileEmail(userId);
      await notifyTagged({
        userId: data.taggedUserId,
        taggerName: me.name,
        link: "/gallery",
        relatedId: data.galleryItemId,
      });
    }
    return { ok: true };
  });

export const removePhotoTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { error } = await supabase.from("gallery_tags").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const inviteTagByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        galleryItemId: z.string().uuid(),
        email: z.string().trim().email().max(200),
        note: z.string().trim().max(300).optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const email = data.email.toLowerCase();

    const { inviteAlreadySent, invitesSentToday, profileEmail } = await import(
      "./gallery-tags.server"
    );
    if (await inviteAlreadySent(data.galleryItemId, email)) {
      return { ok: true, already: true };
    }
    if ((await invitesSentToday(userId)) >= 20) {
      throw new Error("Daily invite limit reached. Please try again tomorrow.");
    }

    const { data: item } = await supabase
      .from("gallery_items")
      .select("id, image_url, title, caption")
      .eq("id", data.galleryItemId)
      .eq("is_published", true)
      .maybeSingle();
    if (!item) throw new Error("Photo not found");

    const me = await profileEmail(userId);
    const { buildTagInviteEmail } = await import("./gallery-tag-email.server");
    const { sendEmail } = await import("./email.server");
    const { signStoredUrl } = await import("./storage-urls.server");
    const photoUrl =
      (await signStoredUrl(supabase, item.image_url as string, 60 * 60 * 24 * 30)) ??
      (item.image_url as string);
    const mail = buildTagInviteEmail({
      taggerName: me.name,
      photoUrl,
      photoTitle: (item.title as string) || (item.caption as string) || null,
      note: data.note || null,
    });

    await sendEmail({
      to: [email],
      subject: mail.subject,
      html: mail.html,
      from: "Just Wheels Hessequa <invites@notify.justwheels.co.za>",
      ...(me.email ? { replyTo: me.email } : {}),
    });

    const { error } = await supabase.from("gallery_tag_invites").insert({
      gallery_item_id: data.galleryItemId,
      email,
      note: data.note || null,
      invited_by: userId,
    });
    if (error) console.error("[gallery-tags] invite log failed", error);

    return { ok: true, already: false };
  });
