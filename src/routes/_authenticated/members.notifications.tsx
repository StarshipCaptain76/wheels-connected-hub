import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { useI18n } from "@/i18n/I18nProvider";
import {
  fetchNotifications,
  markAllRead,
  markRead,
  notifBody,
  notifTitle,
} from "@/lib/notifications";

export const Route = createFileRoute("/_authenticated/members/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications | Just Wheels Hessequa" },
      {
        name: "description",
        content:
          "Your Just Wheels Hessequa alerts: new classifieds, events, newsletters and club admin tasks.",
      },
      { property: "og:title", content: "Notifications | Just Wheels Hessequa" },
      {
        property: "og:description",
        content: "Club alerts for new classifieds, events and newsletters.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["notifications", "all"],
    queryFn: () => fetchNotifications(100),
  });

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <SiteLayout>
      <section className="mx-auto max-w-3xl px-4 py-10">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-3xl tracking-wide text-ink">
            <Bell className="mr-2 inline h-6 w-6 text-primary" />
            {t("notif.title")}
          </h1>
          <button
            type="button"
            onClick={async () => {
              await markAllRead();
              await refresh();
            }}
            className="rounded-md border-2 border-ink bg-paper px-3 py-2 text-xs font-bold uppercase tracking-wider text-ink hover:bg-ink/5"
          >
            {t("notif.markAll")}
          </button>
        </div>

        <ul className="mt-6 space-y-3">
          {!isLoading && items.length === 0 && (
            <li className="rounded-xl border-2 border-dashed border-ink/30 px-4 py-10 text-center text-ink/60">
              {t("notif.empty")}
            </li>
          )}
          {items.map((n) => {
            const inner = (
              <div
                className={`rounded-xl border-2 border-ink p-4 shadow-[3px_3px_0_0_var(--color-ink)] ${n.read_at ? "bg-paper" : "bg-primary/5"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-bold text-ink">{notifTitle(n, lang)}</p>
                  <span className="shrink-0 text-xs text-ink/50">
                    {new Date(n.created_at).toLocaleDateString()}
                  </span>
                </div>
                {notifBody(n, lang) && (
                  <p className="mt-1 text-sm text-ink/70">{notifBody(n, lang)}</p>
                )}
              </div>
            );
            return (
              <li key={n.id}>
                {n.link ? (
                  <Link
                    to={n.link}
                    onClick={async () => {
                      if (!n.read_at) {
                        await markRead(n.id);
                        await refresh();
                      }
                    }}
                    className="block"
                  >
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </SiteLayout>
  );
}
