import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/SiteLayout";
import { useI18n } from "@/i18n/I18nProvider";
import {
  listUpcomingEvents,
  listPastEvents,
  type PublicEvent,
} from "@/lib/events.functions";
import { listGoogleCalendarEvents } from "@/lib/gcal.functions";
import { Calendar, MapPin } from "lucide-react";

const upcomingQuery = queryOptions({
  queryKey: ["events", "upcoming", "combined"],
  queryFn: async (): Promise<PublicEvent[]> => {
    const [db, gcal] = await Promise.all([listUpcomingEvents(), listGoogleCalendarEvents()]);
    const seen = new Set(db.map((e) => `${e.title}|${e.starts_at.slice(0, 10)}`));
    const merged = [
      ...db,
      ...gcal.filter((e) => !seen.has(`${e.title}|${e.starts_at.slice(0, 10)}`)),
    ];
    return merged.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  },
  staleTime: 60_000,
});

const pastQuery = queryOptions({
  queryKey: ["events", "past"],
  queryFn: () => listPastEvents(),
  staleTime: 60_000,
});

const SITE_ORIGIN = "https://www.justwheels.co.za";
const OG_LOGO = `${SITE_ORIGIN}/__l5e/assets-v1/1ea9f7fc-2fa5-428f-a1df-f1a298d9caaa/justwheels-logo.jpeg`;

export const Route = createFileRoute("/events/")({
  head: ({ loaderData }) => {
    const events = (loaderData as { upcoming: PublicEvent[] } | undefined)?.upcoming ?? [];
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: events.slice(0, 20).map((ev, idx) => ({
        "@type": "ListItem",
        position: idx + 1,
        item: {
          "@type": "Event",
          name: ev.title,
          startDate: ev.starts_at,
          endDate: ev.ends_at ?? undefined,
          eventStatus: "https://schema.org/EventScheduled",
          eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
          location: ev.location
            ? {
                "@type": "Place",
                name: ev.location,
                address: {
                  "@type": "PostalAddress",
                  addressRegion: "Western Cape",
                  addressCountry: "ZA",
                },
              }
            : undefined,
          description: ev.description ?? undefined,
          image: ev.cover_display_url ?? ev.cover_url ?? undefined,
          organizer: {
            "@type": "Organization",
            name: "Just Wheels Hessequa",
            url: SITE_ORIGIN,
          },
        },
      })),
    };
    return {
      meta: [
        { title: "Events | Just Wheels Hessequa" },
        {
          name: "description",
          content:
            "Upcoming and past breakfast runs, show-and-shines, cruises and workshop days for Just Wheels Hessequa.",
        },
        { property: "og:title", content: "Events | Just Wheels Hessequa" },
        {
          property: "og:description",
          content: "Upcoming runs, shows and cruises across the Southern Cape.",
        },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${SITE_ORIGIN}/events` },
        { property: "og:image", content: OG_LOGO },
        { name: "twitter:image", content: OG_LOGO },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: `${SITE_ORIGIN}/events` }],
      scripts: [{ type: "application/ld+json", children: JSON.stringify(jsonLd) }],
    };
  },
  loader: async ({ context }) => {
    const [upcoming, past] = await Promise.all([
      context.queryClient.ensureQueryData(upcomingQuery),
      context.queryClient.ensureQueryData(pastQuery),
    ]);
    return { upcoming, past };
  },
  component: EventsPage,
  errorComponent: ({ error }) => (
    <SiteLayout>
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="text-ink/70">Could not load events: {error.message}</p>
      </div>
    </SiteLayout>
  ),
  pendingComponent: () => (
    <SiteLayout>
      <div className="mx-auto max-w-3xl px-4 py-20 text-center text-ink/60">Loading…</div>
    </SiteLayout>
  ),
});

function formatDate(iso: string, lang: "en" | "af") {
  return new Date(iso).toLocaleDateString(lang === "af" ? "af-ZA" : "en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(iso: string, lang: "en" | "af") {
  return new Date(iso).toLocaleTimeString(lang === "af" ? "af-ZA" : "en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Whole-day difference between the event date and today, in South African time. */
function sastDayDiff(iso: string): number {
  const key = (d: Date) => {
    const s = new Date(d.getTime() + 2 * 60 * 60 * 1000);
    return Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate());
  };
  return Math.round((key(new Date(iso)) - key(new Date())) / 86_400_000);
}

const isDbId = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

function TodayHero({ event, lang }: { event: PublicEvent; lang: "en" | "af" }) {
  const { t } = useI18n();
  const [countdown, setCountdown] = useState<string | null>(null);
  const startsAt = event.starts_at;

  useEffect(() => {
    const tick = () => {
      const ms = new Date(startsAt).getTime() - Date.now();
      if (ms <= 0) {
        setCountdown(t("home.underWay"));
        return;
      }
      const mins = Math.round(ms / 60000);
      setCountdown(
        mins < 60
          ? t("home.startsInMinutes").replace("{n}", String(mins))
          : t("home.startsInHours").replace("{n}", String(Math.round(mins / 60))),
      );
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [startsAt, t]);

  const title = lang === "af" && event.title_af ? event.title_af : event.title;
  const description =
    lang === "af" && event.description_af ? event.description_af : event.description;

  return (
    <div className="border-b-2 border-ink bg-ink text-white">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-xs tracking-[0.3em] text-white/80">
            {t("home.happeningToday").toUpperCase()}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-widest">
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
            {t("home.todayBadge")}
          </span>
        </div>
        <h2 className="mt-2 font-display text-4xl tracking-wide sm:text-6xl">{title}</h2>
        <p className="mt-1 font-display text-2xl tracking-wide text-primary sm:text-3xl">
          {formatTime(event.starts_at, lang)}
          {event.location ? (
            <span className="ml-2 font-sans text-sm font-semibold text-white/85">
              · {event.location}
            </span>
          ) : null}
        </p>
        {countdown && <p className="mt-1 text-sm font-bold text-white/90">{countdown}</p>}
        {description ? (
          <p className="mt-3 max-w-2xl text-sm text-white/85 line-clamp-3">{description}</p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-3">
          {isDbId(event.id) && (
            <a
              href={`/events/${event.id}`}
              className="inline-flex items-center rounded-md border-2 border-white bg-primary px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-white"
            >
              {t("home.seeDetails")}
            </a>
          )}
          {event.location && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-md border-2 border-white/70 px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-white hover:border-white"
            >
              {t("home.getDirections")}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function EventsPage() {
  const { t, lang } = useI18n();
  const { data: upcoming } = useSuspenseQuery(upcomingQuery);
  const { data: past } = useSuspenseQuery(pastQuery);

  // Computed after hydration so SSR and client markup match.
  const [todayIds, setTodayIds] = useState<string[]>([]);
  useEffect(() => {
    const tick = () =>
      setTodayIds(upcoming.filter((e) => sastDayDiff(e.starts_at) === 0).map((e) => e.id));
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [upcoming]);

  const todaySet = new Set(todayIds);
  const todayEvents = upcoming.filter((e) => todaySet.has(e.id));
  const restUpcoming = upcoming.filter((e) => !todaySet.has(e.id));

  return (
    <SiteLayout>
      {todayEvents.map((ev) => (
        <TodayHero key={ev.id} event={ev} lang={lang} />
      ))}

      <section className="border-b-2 border-ink bg-ink text-paper">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="mb-3 inline-block rounded-full border-2 border-primary bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.25em] text-primary">
            {t("nav.events")}
          </div>
          <h1 className="font-display text-5xl tracking-wide sm:text-6xl">
            {lang === "af" ? "Kom bymekaar. Ry." : "Show up. Roll out."}
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-paper/80">
            {lang === "af"
              ? "Komende én vorige ritte, shows en werkswinkeldae. Lede kan fotos byvoeg by elke byeenkoms."
              : "Upcoming and past runs, shows and workshop days. Members can add photos to any event."}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="font-display text-3xl tracking-wide text-ink">
          {lang === "af" ? "Komende" : "Upcoming"}
        </h2>
        {restUpcoming.length === 0 ? (
          <div className="mt-6 rounded-lg border-2 border-dashed border-ink/30 bg-card p-12 text-center">
            <p className="font-display text-2xl text-ink">
              {lang === "af" ? "Geen komende byeenkomste nie." : "No upcoming events yet."}
            </p>
            <p className="mt-2 text-ink/60">
              {lang === "af"
                ? "Hou hierdie ruimte dop — die kalender word gou opgedateer."
                : "Watch this space — the calendar refills soon."}
            </p>
          </div>
        ) : (
          <ul className="mt-6 grid gap-6 md:grid-cols-2">
            {restUpcoming.map((ev) => (
              <EventCard key={ev.id} event={ev} lang={lang} />
            ))}
          </ul>
        )}
      </section>


      {past.length > 0 && (
        <section className="border-t-2 border-ink bg-steel/10">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <h2 className="font-display text-3xl tracking-wide text-ink">
              {lang === "af" ? "Vorige byeenkomste" : "Past events"}
            </h2>
            <p className="mt-2 text-sm text-ink/60">
              {lang === "af"
                ? "Blaai deur vorige dae en voeg steeds fotos by."
                : "Browse past days and keep adding photos."}
            </p>
            <ul className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {past.map((ev) => (
                <EventCard key={ev.id} event={ev} lang={lang} past />
              ))}
            </ul>
          </div>
        </section>
      )}
    </SiteLayout>
  );
}

function EventCard({
  event,
  lang,
  past = false,
}: {
  event: PublicEvent;
  lang: "en" | "af";
  past?: boolean;
}) {
  const title = lang === "af" && event.title_af ? event.title_af : event.title;
  const description =
    lang === "af" && event.description_af ? event.description_af : event.description;
  const isDbEvent = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    event.id,
  );

  const body = (
    <>
      {event.cover_display_url ?? event.cover_url ? (
        <img
          src={event.cover_display_url ?? event.cover_url ?? ""}
          alt=""
          className={`h-40 w-full border-b-2 border-ink object-cover ${past ? "opacity-90" : ""}`}
        />
      ) : (
        <div
          className="h-28 w-full border-b-2 border-ink"
          style={{
            background:
              "repeating-linear-gradient(45deg, var(--color-primary) 0 12px, var(--color-ink) 12px 24px)",
          }}
          aria-hidden
        />
      )}
      <div className="p-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold uppercase tracking-wider text-primary">
          {past && (
            <span className="rounded-full border border-ink/30 bg-ink/5 px-2 py-0.5 text-[10px] text-ink/60">
              {lang === "af" ? "Verby" : "Past"}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {formatDate(event.starts_at, lang)} · {formatTime(event.starts_at, lang)}
          </span>
          {event.location ? (
            <span className="inline-flex items-center gap-1 text-ink/60">
              <MapPin className="h-3.5 w-3.5" />
              {event.location}
            </span>
          ) : null}
        </div>
        <h2 className="mt-2 font-display text-xl tracking-wide text-ink">{title}</h2>
        {description ? <p className="mt-2 line-clamp-2 text-sm text-ink/70">{description}</p> : null}
        {isDbEvent ? (
          <p className="mt-3 text-xs font-bold uppercase tracking-wider text-primary">
            {past
              ? lang === "af"
                ? "Fotos & besonderhede →"
                : "Photos & details →"
              : lang === "af"
                ? "Sien meer →"
                : "See details →"}
          </p>
        ) : (
          <p className="mt-3 text-xs text-ink/40">
            {lang === "af" ? "Kalender-item (geen detailblad)" : "Calendar item (no detail page)"}
          </p>
        )}
      </div>
    </>
  );

  const cls =
    "group block overflow-hidden rounded-lg border-2 border-ink bg-card shadow-[4px_4px_0_0_var(--color-ink)] transition-transform hover:-translate-y-1";

  // Plain <a> guarantees navigation even if client router hiccups
  if (isDbEvent) {
    return (
      <li>
        <a href={`/events/${event.id}`} className={cls}>
          {body}
        </a>
      </li>
    );
  }

  return (
    <li>
      <div className={cls}>{body}</div>
    </li>
  );
}
