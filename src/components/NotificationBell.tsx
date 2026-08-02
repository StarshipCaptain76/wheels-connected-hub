import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n/I18nProvider";
import {
  fetchNotifications,
  markAllRead,
  markRead,
  notifBody,
  notifTitle,
  type AppNotification,
} from "@/lib/notifications";

function timeAgo(iso: string, lang: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return lang === "af" ? "nou" : "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

export function NotificationBell() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (mounted) setUserId(data.session?.user.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user.id ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const { data: items = [] } = useQuery({
    queryKey: ["notifications", userId],
    queryFn: () => fetchNotifications(20),
    enabled: Boolean(userId),
    staleTime: 30_000,
  });

  // Live updates
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => {
          void qc.invalidateQueries({ queryKey: ["notifications", userId] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, qc]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const el = e.target as HTMLElement | null;
      if (el && !el.closest("[data-notif-menu]")) setOpen(false);
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [open]);

  if (!userId) return null;

  const unread = items.filter((n) => !n.read_at).length;

  async function onOpenItem(n: AppNotification) {
    setOpen(false);
    if (!n.read_at) {
      try {
        await markRead(n.id);
        void qc.invalidateQueries({ queryKey: ["notifications", userId] });
      } catch {
        /* non-blocking */
      }
    }
    if (n.link) void navigate({ to: n.link });
  }

  return (
    <div className="relative" data-notif-menu ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t("notif.title")}
        aria-expanded={open}
        className="relative inline-flex h-12 w-12 items-center justify-center rounded-md border-2 border-ink bg-paper text-ink transition-colors hover:bg-ink/5"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full border-2 border-ink bg-primary px-1 text-[11px] font-bold leading-4 text-paper">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-lg border-2 border-ink bg-paper shadow-[4px_4px_0_0_var(--color-ink)]">
          <div className="flex items-center justify-between border-b-2 border-ink px-3 py-2">
            <span className="font-display text-sm tracking-wide text-ink">{t("notif.title")}</span>
            {unread > 0 && (
              <button
                type="button"
                className="text-xs font-bold uppercase tracking-wider text-primary hover:underline"
                onClick={async () => {
                  try {
                    await markAllRead();
                    void qc.invalidateQueries({ queryKey: ["notifications", userId] });
                  } catch {
                    /* non-blocking */
                  }
                }}
              >
                {t("notif.markAll")}
              </button>
            )}
          </div>

          <ul className="max-h-[60vh] divide-y divide-ink/10 overflow-y-auto">
            {items.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-ink/60">{t("notif.empty")}</li>
            )}
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => void onOpenItem(n)}
                  className={`flex w-full items-start gap-2 px-3 py-3 text-left hover:bg-ink/5 ${n.read_at ? "" : "bg-primary/5"}`}
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read_at ? "bg-transparent" : "bg-primary"}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-ink">{notifTitle(n, lang)}</span>
                    {notifBody(n, lang) && (
                      <span className="mt-0.5 block text-xs text-ink/70">{notifBody(n, lang)}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-[11px] text-ink/50">{timeAgo(n.created_at, lang)}</span>
                </button>
              </li>
            ))}
          </ul>

          <div className="border-t-2 border-ink px-3 py-2 text-center">
            <Link
              to="/members/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-bold uppercase tracking-wider text-ink hover:text-primary"
            >
              {t("notif.viewAll")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
