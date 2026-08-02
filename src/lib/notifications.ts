import { supabase } from "@/integrations/supabase/client";

export type NotificationType =
  | "new_listing"
  | "new_event"
  | "new_newsletter"
  | "admin_new_sponsor"
  | "admin_new_member"
  | "admin_listing_review";

export const MEMBER_TYPES: NotificationType[] = ["new_listing", "new_event", "new_newsletter"];
export const ADMIN_TYPES: NotificationType[] = [
  "admin_new_sponsor",
  "admin_new_member",
  "admin_listing_review",
];

export type AppNotification = {
  id: string;
  type: NotificationType;
  title_en: string;
  title_af: string;
  body_en: string | null;
  body_af: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export type NotificationPrefs = Record<NotificationType, boolean>;

export const DEFAULT_PREFS: NotificationPrefs = {
  new_listing: true,
  new_event: true,
  new_newsletter: true,
  admin_new_sponsor: true,
  admin_new_member: true,
  admin_listing_review: true,
};

const SELECT = "id, type, title_en, title_af, body_en, body_af, link, read_at, created_at";

export async function fetchNotifications(limit = 50): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select(SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AppNotification[];
}

export async function markRead(id: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);
  if (error) throw error;
}

export async function markAllRead() {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) throw error;
}

export async function fetchPrefs(): Promise<NotificationPrefs> {
  const { data, error } = await supabase
    .from("notification_prefs")
    .select(
      "new_listing, new_event, new_newsletter, admin_new_sponsor, admin_new_member, admin_listing_review",
    )
    .maybeSingle();
  if (error) throw error;
  return { ...DEFAULT_PREFS, ...(data ?? {}) } as NotificationPrefs;
}

export async function savePrefs(prefs: Partial<NotificationPrefs>) {
  const { data: session } = await supabase.auth.getUser();
  const userId = session.user?.id;
  if (!userId) throw new Error("Not signed in");
  const { error } = await supabase
    .from("notification_prefs")
    .upsert({ user_id: userId, ...prefs }, { onConflict: "user_id" });
  if (error) throw error;
}

export function notifTitle(n: AppNotification, lang: string) {
  return lang === "af" ? n.title_af || n.title_en : n.title_en;
}

export function notifBody(n: AppNotification, lang: string) {
  return lang === "af" ? n.body_af || n.body_en : n.body_en;
}
