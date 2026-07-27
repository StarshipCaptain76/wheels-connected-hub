import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/SiteLayout";
import { useI18n } from "@/i18n/I18nProvider";
import { listUpcomingEvents, type PublicEvent } from "@/lib/events.functions";
import { listGoogleCalendarEvents } from "@/lib/gcal.functions";
import { Calendar, MapPin } from "lucide-react";

const eventsQuery = queryOptions({
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


const SITE_ORIGIN = "https://justwheels.co.za";
const OG_LOGO = `${SITE_ORIGIN}/__l5e/assets-v1/1ea9f7fc-2fa5-428f-a1df-f1a298d9caaa/justwheels-logo.jpeg`;

export const Route = createFileRoute("/events")({
  head: ({ loaderData }) => {
    const events = (loaderData as PublicEvent[] | undefined) ?? [];
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
                address: { "@type": "PostalAddress", addressRegion: "Western Cape", addressCountry: "ZA" },
              }
            : undefined,
          description: ev.description ?? undefined,
          image: ev.cover_url ?? undefined,
          organizer: { "@type": "Organization", name: "Just Wheels Hessequa", url: SITE_ORIGIN },
        },
      })),
    };
    return {
      meta: [
        { title: "Events | Just Wheels Hessequa" },
        {
          name: "description",
          content:
            "Upcoming breakfast runs, show-and-shines, cruises and workshop days for the Just Wheels Hessequa car club in the Southern Cape.",
        },
        { property: "og:title", content: "Events | Just Wheels Hessequa" },
        { property: "og:description", content: "Upcoming runs, shows and cruises across the Southern Cape." },
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
  loader: ({ context }) => context.queryClient.ensureQueryData(eventsQuery),
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

function EventsPage() {
  const { t, lang } = useI18n();
  const { data: events } = useSuspenseQuery(eventsQuery);

  return (
    <SiteLayout>
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
              ? "Ons volgende ritte, shows en werkswinkeldae oor die Suid-Kaap."
              : "Our next runs, shows and workshop days across the Southern Cape."}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        {events.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-ink/30 bg-card p-12 text-center">
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
          <ul className="grid gap-6 md:grid-cols-2">
            {events.map((ev) => (
              <EventCard key={ev.id} event={ev} lang={lang} />
            ))}
          </ul>
        )}
      </section>
    </SiteLayout>
  );
}

function EventCard({ event, lang }: { event: PublicEvent; lang: "en" | "af" }) {
  const title = lang === "af" && event.title_af ? event.title_af : event.title;
  const description =
    lang === "af" && event.description_af ? event.description_af : event.description;

  return (
    <li className="group overflow-hidden rounded-lg border-2 border-ink bg-card shadow-[4px_4px_0_0_var(--color-ink)] transition-transform hover:-translate-y-1">
      {event.cover_url ? (
        <img
          src={event.cover_url}
          alt=""
          className="h-48 w-full border-b-2 border-ink object-cover"
        />
      ) : (
        <div
          className="h-32 w-full border-b-2 border-ink"
          style={{
            background:
              "repeating-linear-gradient(45deg, var(--color-primary) 0 12px, var(--color-ink) 12px 24px)",
          }}
          aria-hidden
        />
      )}
      <div className="p-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold uppercase tracking-wider text-primary">
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
        <h2 className="mt-3 font-display text-2xl tracking-wide text-ink">{title}</h2>
        {description ? <p className="mt-2 text-ink/70">{description}</p> : null}
      </div>
    </li>
  );
}
