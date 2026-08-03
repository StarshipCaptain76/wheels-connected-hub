import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { EventMap } from "@/components/EventMap";
import { EventPhotosGallery } from "@/components/EventPhotosGallery";
import { ConcoursChallenge } from "@/components/ConcoursChallenge";
import { useI18n } from "@/i18n/I18nProvider";
import {
  getEventDetail,
  listEventAttendees,
  getMyRsvp,
  upsertMyRsvp,
  deleteMyRsvp,
  type EventDetail,
} from "@/lib/events-detail.functions";
import { distancesFromOrigins, computeRoute } from "@/lib/maps.functions";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, MapPin, ArrowLeft, Users, ExternalLink } from "lucide-react";

const eventQuery = (id: string) =>
  queryOptions({
    queryKey: ["event", id],
    queryFn: async () => {
      try {
        return await getEventDetail({ data: { id } });
      } catch (e) {
        console.error("[event detail]", id, e);
        throw e;
      }
    },
    staleTime: 60_000,
  });

const SITE_ORIGIN = "https://justwheels.co.za";

export const Route = createFileRoute("/events/$id")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(eventQuery(params.id));
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData, params }) => {
    const ev = loaderData as EventDetail | null | undefined;
    const title = ev ? `${ev.title} | Just Wheels Hessequa` : "Event | Just Wheels Hessequa";
    // Social/Schema crawlers need absolute URLs — our proxy path is relative.
    const shareImage = ev?.cover_url
      ? ev.cover_url.startsWith("http")
        ? ev.cover_url
        : `${SITE_ORIGIN}${ev.cover_url}`
      : null;
    return {
      meta: [
        { title },
        { name: "description", content: ev?.description ?? "Just Wheels Hessequa event details." },
        { property: "og:title", content: title },
        { property: "og:description", content: ev?.description ?? "" },
        { property: "og:type", content: "article" },
        { property: "og:url", content: `${SITE_ORIGIN}/events/${params.id}` },
        ...(shareImage
          ? [
              { property: "og:image", content: shareImage },
              { name: "twitter:image", content: shareImage },
            ]
          : []),
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: `${SITE_ORIGIN}/events/${params.id}` }],
      ...(ev
        ? {
            scripts: [
              {
                type: "application/ld+json",
                children: JSON.stringify({
                  "@context": "https://schema.org",
                  "@type": "Event",
                  name: ev.title,
                  startDate: ev.starts_at,
                  description: ev.description ?? undefined,
                  url: `${SITE_ORIGIN}/events/${params.id}`,
                  image: shareImage ?? undefined,
                  eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
                  location: ev.location
                    ? { "@type": "Place", name: ev.location, address: ev.location }
                    : undefined,
                  organizer: {
                    "@type": "Organization",
                    name: "Just Wheels Hessequa",
                    url: SITE_ORIGIN,
                  },
                }),
              },
            ],
          }
        : {}),
    };
  },
  component: EventDetailPage,
  notFoundComponent: () => (
    <SiteLayout>
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="font-display text-3xl">Event not found</h1>
        <p className="mt-2 text-sm text-ink/60">
          This event may be unpublished or the link is outdated.
        </p>
        <Link to="/events" className="mt-4 inline-block text-primary underline">
          Back to events
        </Link>
      </div>
    </SiteLayout>
  ),
  errorComponent: ({ error }) => (
    <SiteLayout>
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="text-ink/70">Could not load event: {error.message}</p>
        <Link to="/events" className="mt-4 inline-block text-primary underline">
          Back to events
        </Link>
      </div>
    </SiteLayout>
  ),
});

function fmtDate(iso: string, lang: "en" | "af") {
  return new Date(iso).toLocaleString(lang === "af" ? "af-ZA" : "en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function EventDetailPage() {
  const { id } = Route.useParams();
  const { lang } = useI18n();
  const { data } = useSuspenseQuery(eventQuery(id));

  if (!data) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-2xl px-4 py-20 text-center">
          <h1 className="font-display text-3xl">Not published</h1>
          <Link to="/events" className="mt-4 inline-block text-primary underline">
            Back to events
          </Link>
        </div>
      </SiteLayout>
    );
  }

  const title = lang === "af" && data.title_af ? data.title_af : data.title;
  const details = lang === "af" && data.details_af_md ? data.details_af_md : data.details_md;
  const description =
    lang === "af" && data.description_af ? data.description_af : data.description;
  const destination =
    data.destination_lat != null && data.destination_lng != null
      ? { lat: data.destination_lat, lng: data.destination_lng }
      : null;

  const isPast = new Date(data.starts_at).getTime() < Date.now();
  const iconUrl = data.cover_url || null;

  const waypointCoords = data.waypoints
    .filter((w) => w.lat != null && w.lng != null)
    .map((w) => ({ lat: w.lat as number, lng: w.lng as number, label: w.label }));

  const routeQuery = useQuery({
    queryKey: ["event-route", id, destination, waypointCoords.length],
    enabled: !!destination,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (!destination || waypointCoords.length === 0) return null;
      return computeRoute({
        data: {
          origin: waypointCoords[0],
          waypoints: waypointCoords.slice(1),
          destination,
        },
      });
    },
  });

  const distancesQuery = useQuery({
    queryKey: ["event-distances", id, destination],
    enabled: !!destination,
    staleTime: 60 * 60_000,
    queryFn: async () => (destination ? distancesFromOrigins({ data: { destination } }) : []),
  });

  return (
    <SiteLayout>
      <section className="mx-auto max-w-4xl px-4 py-10">
        <Link
          to="/events"
          className="mb-4 inline-flex items-center gap-2 text-sm text-ink/60 hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />{" "}
          {lang === "af" ? "Terug na byeenkomste" : "Back to events"}
        </Link>

        <div className="flex flex-wrap items-start gap-4">
          {iconUrl && (
            <img
              src={iconUrl}
              alt=""
              className="h-16 w-16 shrink-0 rounded-lg border-2 border-ink object-cover shadow-[3px_3px_0_0_var(--color-ink)] sm:h-20 sm:w-20"
            />
          )}
          <div className="min-w-0 flex-1">
            {isPast && (
              <span className="mb-2 inline-block rounded-full border border-ink/30 bg-ink/5 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink/60">
                {lang === "af" ? "Vorige byeenkoms" : "Past event"}
              </span>
            )}
            <h1 className="font-display text-4xl tracking-wide text-ink sm:text-5xl">{title}</h1>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink/70">
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-4 w-4 text-primary" />
                {fmtDate(data.starts_at, lang)}
              </span>
              {data.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-primary" />
                  {data.location}
                </span>
              )}
            </div>
          </div>
        </div>

        {description && <p className="mt-4 text-lg text-ink/80">{description}</p>}

        {destination && (
          <section className="mt-8">
            <h2 className="font-display text-2xl text-ink">
              {lang === "af" ? "Kaart en roete" : "Map & route"}
            </h2>
            {data.destination_address && (
              <p className="mt-1 text-sm text-ink/60">{data.destination_address}</p>
            )}
            <div className="mt-3">
              <EventMap
                destination={destination}
                waypoints={waypointCoords}
                encodedPolyline={routeQuery.data?.encodedPolyline}
              />
            </div>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}${data.destination_place_id ? `&destination_place_id=${data.destination_place_id}` : ""}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-sm text-primary underline"
            >
              Open in Google Maps
              <ExternalLink className="h-3 w-3" />
            </a>
          </section>
        )}

        {data.waypoints.length > 0 && (
          <section className="mt-8">
            <h2 className="font-display text-2xl text-ink">
              {lang === "af" ? "Bymekaarkomstoppe" : "Meetup stops"}
            </h2>
            <ol className="mt-3 space-y-2">
              {data.waypoints.map((w, i) => {
                const wLabel = lang === "af" && w.label_af ? w.label_af : w.label;
                return (
                  <li key={w.id} className="flex gap-3 rounded-lg border-2 border-ink bg-card p-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-primary font-bold text-paper">
                      {i + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-ink">{wLabel}</p>
                      {w.address && <p className="text-sm text-ink/60">{w.address}</p>}
                      {w.meet_time && (
                        <p className="mt-1 text-xs font-bold uppercase tracking-wider text-primary">
                          {new Date(w.meet_time).toLocaleString(lang === "af" ? "af-ZA" : "en-ZA", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {destination && distancesQuery.data && distancesQuery.data.length > 0 && (
          <section className="mt-8">
            <h2 className="font-display text-2xl text-ink">
              {lang === "af" ? "Afstande vanaf" : "Distances from"}
            </h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {distancesQuery.data.map((d) => (
                <li
                  key={d.originKey}
                  className="flex items-center justify-between rounded-lg border-2 border-ink bg-card px-3 py-2"
                >
                  <span className="font-bold text-ink">{d.label}</span>
                  <span className="text-sm text-ink/70">
                    {(d.distanceMeters / 1000).toFixed(0)} km · {Math.round(d.durationSeconds / 60)}{" "}
                    min
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {details && (
          <section className="mt-8">
            <h2 className="font-display text-2xl text-ink">
              {lang === "af" ? "Meer inligting" : "More info"}
            </h2>
            <div className="mt-3 whitespace-pre-wrap rounded-lg border-2 border-ink bg-card p-4 text-ink/80">
              {details}
            </div>
          </section>
        )}

        {!isPast && (
          <section className="mt-8 rounded-lg border-2 border-ink bg-paper p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">
              {lang === "af" ? "Wie kom" : "Who's coming"}
            </p>
            <p className="mt-1 text-ink/80">
              <span className="font-bold">{data.counts.going}</span>{" "}
              {lang === "af" ? "gaan" : "going"}
              {" · "}
              <span className="font-bold">{data.counts.going_party_total}</span>{" "}
              {lang === "af" ? "mense in totaal" : "people total"}
              {" · "}
              <span className="font-bold">{data.counts.maybe}</span>{" "}
              {lang === "af" ? "dalk" : "maybe"}
            </p>
          </section>
        )}

        {!isPast && <RsvpSection eventId={data.id} />}

        <EventPhotosGallery eventId={data.id} lang={lang} />

        <ConcoursChallenge eventId={data.id} eventStartsAt={data.starts_at} />
      </section>
    </SiteLayout>
  );
}

function RsvpSection({ eventId }: { eventId: string }) {
  const { lang } = useI18n();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (signedIn === null) return null;

  if (!signedIn) {
    return (
      <section className="mt-6 rounded-lg border-2 border-dashed border-ink/40 bg-card p-6 text-center">
        <p className="text-ink/80">
          {lang === "af"
            ? "Teken in as lid om jou RSVP te wys en die byrys-lys te sien."
            : "Sign in as a member to RSVP and see who's attending."}
        </p>
        <Link
          to="/auth"
          search={{ redirect: `/events/${eventId}` }}
          className="mt-3 inline-block rounded-md border-2 border-ink bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-paper"
        >
          {lang === "af" ? "Teken in" : "Sign in"}
        </Link>
      </section>
    );
  }
  return <MemberRsvpBlock eventId={eventId} />;
}

function MemberRsvpBlock({ eventId }: { eventId: string }) {
  const { lang } = useI18n();
  const qc = useQueryClient();
  const my = useQuery({
    queryKey: ["rsvp", eventId, "me"],
    queryFn: () => getMyRsvp({ data: { id: eventId } }),
  });
  const attendees = useQuery({
    queryKey: ["rsvp", eventId, "attendees"],
    queryFn: () => listEventAttendees({ data: { id: eventId } }),
  });
  const upsert = useServerFn(upsertMyRsvp);
  const del = useServerFn(deleteMyRsvp);
  const [party, setParty] = useState(1);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (my.data) {
      setParty(my.data.party_size ?? 1);
      setNote(my.data.note ?? "");
    }
  }, [my.data]);

  async function submit(status: "going" | "maybe" | "not_going") {
    await upsert({ data: { eventId, status, partySize: party, note: note || null } });
    await qc.invalidateQueries({ queryKey: ["rsvp", eventId] });
    await qc.invalidateQueries({ queryKey: ["event", eventId] });
  }
  async function clear() {
    await del({ data: { eventId } });
    await qc.invalidateQueries({ queryKey: ["rsvp", eventId] });
    await qc.invalidateQueries({ queryKey: ["event", eventId] });
  }

  const current = my.data?.status;
  const going = attendees.data?.filter((a) => a.status === "going") ?? [];
  const maybe = attendees.data?.filter((a) => a.status === "maybe") ?? [];

  return (
    <section className="mt-6 rounded-lg border-2 border-ink bg-card p-6">
      <h3 className="font-display text-xl text-ink">
        {lang === "af" ? "Sal jy daar wees?" : "Are you going?"}
      </h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {(["going", "maybe", "not_going"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => submit(s)}
            className={`rounded-md border-2 border-ink px-4 py-2 text-sm font-bold uppercase tracking-wider ${
              current === s
                ? "bg-primary text-paper"
                : "bg-paper text-ink hover:bg-ink hover:text-paper"
            }`}
          >
            {s === "going"
              ? lang === "af"
                ? "Ja"
                : "Yes"
              : s === "maybe"
                ? lang === "af"
                  ? "Dalk"
                  : "Maybe"
                : lang === "af"
                  ? "Nee"
                  : "No"}
          </button>
        ))}
        {current && (
          <button
            type="button"
            onClick={clear}
            className="rounded-md border-2 border-ink bg-paper px-3 py-2 text-xs uppercase tracking-wider text-ink/60"
          >
            {lang === "af" ? "Verwyder" : "Clear"}
          </button>
        )}
      </div>
      {current === "going" && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-ink/70">
              {lang === "af" ? "Hoeveel mense" : "How many people"}
            </span>
            <input
              type="number"
              min={1}
              max={10}
              value={party}
              onChange={(e) => setParty(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
              onBlur={() => submit("going")}
              className="mt-1 w-full rounded-md border-2 border-ink bg-paper px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-ink/70">
              {lang === "af" ? "Nota (opsioneel)" : "Note (optional)"}
            </span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => submit("going")}
              maxLength={280}
              className="mt-1 w-full rounded-md border-2 border-ink bg-paper px-3 py-2"
            />
          </label>
        </div>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <AttendeeList title={lang === "af" ? "Bevestig" : "Going"} rows={going} lang={lang} />
        <AttendeeList title={lang === "af" ? "Dalk" : "Maybe"} rows={maybe} lang={lang} />
      </div>
    </section>
  );
}

function AttendeeList({
  title,
  rows,
  lang,
}: {
  title: string;
  rows: Array<{
    user_id: string;
    display_name: string | null;
    member_number: number;
    town: string | null;
    party_size: number;
  }>;
  lang: "en" | "af";
}) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
        <Users className="h-3.5 w-3.5" /> {title} · {rows.length}
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-ink/50">{lang === "af" ? "Niemand nog nie." : "Nobody yet."}</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((r) => (
            <li key={r.user_id} className="text-sm">
              <Link
                to="/members/$number"
                params={{ number: String(r.member_number) }}
                className="text-ink hover:text-primary hover:underline"
              >
                {r.display_name ?? `#${r.member_number}`}
              </Link>
              {r.town && <span className="text-ink/50"> · {r.town}</span>}
              {r.party_size > 1 && <span className="text-ink/50"> · +{r.party_size - 1}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
