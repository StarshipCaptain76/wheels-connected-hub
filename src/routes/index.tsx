import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/SiteLayout";
import { useI18n } from "@/i18n/I18nProvider";
import { LOGO_URL } from "@/lib/brand";
import { Calendar, IdCard, Users } from "lucide-react";
import { getNextEvent } from "@/lib/events.functions";
import { getCurrentFeaturedMember } from "@/lib/featured-member.functions";
import { SponsorCarousel } from "@/components/SponsorCarousel";

const nextEventQuery = queryOptions({
  queryKey: ["events", "next"],
  queryFn: () => getNextEvent(),
  staleTime: 60_000,
});

const featuredQuery = queryOptions({
  queryKey: ["featured-member"],
  queryFn: () => getCurrentFeaturedMember(),
  staleTime: 60_000, // refresh often enough that random garage thumb can vary
});

const SITE_ORIGIN = "https://justwheels.co.za";
const OG_LOGO = `${SITE_ORIGIN}${LOGO_URL}`;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Just Wheels Hessequa | Southern Cape Car Club" },
      {
        name: "description",
        content:
          "Join Just Wheels Hessequa — a car club for classics, hot rods, bakkies and bikes across Riversdale, Stilbaai and the Southern Cape.",
      },
      { property: "og:title", content: "Just Wheels Hessequa | Southern Cape Car Club" },
      {
        property: "og:description",
        content:
          "Join a community car club for classics, hot rods, bakkies and bikes across the Southern Cape.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_ORIGIN}/` },
      { property: "og:image", content: OG_LOGO },
      { name: "twitter:image", content: OG_LOGO },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_ORIGIN}/` }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Just Wheels Hessequa",
          url: SITE_ORIGIN,
        }),
      },
    ],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(nextEventQuery),
      context.queryClient.ensureQueryData(featuredQuery),
    ]);
  },
  component: Index,
});

function formatDate(iso: string, lang: "en" | "af") {
  return new Date(iso).toLocaleDateString(lang === "af" ? "af-ZA" : "en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function initials(name: string | null | undefined): string {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Index() {
  const { t, lang } = useI18n();
  const { data: nextEvent } = useSuspenseQuery(nextEventQuery);
  const { data: featured } = useQuery(featuredQuery);

  const nextTitle = nextEvent
    ? lang === "af" && nextEvent.title_af
      ? nextEvent.title_af
      : nextEvent.title
    : t("home.tbaTitle");

  const nextMeta = nextEvent
    ? `${formatDate(nextEvent.starts_at, lang)}${nextEvent.location ? ` · ${nextEvent.location}` : ""}`
    : null;

  const nextDesc = nextEvent
    ? lang === "af" && nextEvent.description_af
      ? nextEvent.description_af
      : nextEvent.description
    : null;

  const nextBody = nextEvent
    ? [nextMeta, nextDesc].filter(Boolean).join(" — ")
    : t("home.tbaBody");

  const faceSrc =
    featured?.avatar_url?.trim() ||
    featured?.featured_photo_url?.trim() ||
    null;

  const garageThumb = featured?.garage_thumb_url?.trim() || null;

  return (
    <SiteLayout>
      <section className="relative overflow-hidden border-b-2 border-ink bg-ink text-paper grain">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, var(--color-primary) 0, transparent 40%), radial-gradient(circle at 80% 80%, var(--color-rust) 0, transparent 45%)",
          }}
          aria-hidden
        />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-[1.3fr_1fr] md:py-24">
          <div>
            <div className="mb-4 inline-block rounded-full border-2 border-primary bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.25em] text-primary">
              {t("home.heroKicker")}
            </div>
            <h1 className="font-display text-6xl leading-[0.9] tracking-wide sm:text-7xl md:text-8xl">
              JUST WHEELS
              <br />
              <span className="text-primary">HESSEQUA</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-paper/80">{t("home.heroSubtitle")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/join"
                className="inline-flex items-center rounded-md border-2 border-paper bg-primary px-6 py-3 font-bold uppercase tracking-wider text-paper shadow-[4px_4px_0_0_var(--color-paper)] transition-transform hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
              >
                {t("cta.becomeMember")}
              </Link>
              <Link
                to="/events"
                className="inline-flex items-center rounded-md border-2 border-paper/60 px-6 py-3 font-bold uppercase tracking-wider text-paper/80 hover:border-paper hover:text-paper"
              >
                {t("cta.viewEvents")}
              </Link>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <div className="relative">
              <div className="absolute -inset-6 rounded-full bg-primary/30 blur-2xl" aria-hidden />
              <img
                src={LOGO_URL}
                alt="Just Wheels Hessequa club badge"
                className="relative h-64 w-64 -rotate-6 rounded-full border-4 border-paper object-cover shadow-2xl md:h-80 md:w-80"
              />
            </div>
          </div>
        </div>
      </section>

      <Link
        to={nextEvent ? `/events/${nextEvent.id}` : "/events"}
        className="block border-b-2 border-ink bg-primary text-paper transition-colors hover:bg-primary/90"
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6">
          <div className="min-w-0 flex-1">
            <div className="font-display text-xs tracking-[0.3em] text-paper/80">
              {t("home.nextEvent").toUpperCase()}
            </div>
            <div className="font-display text-2xl tracking-wide sm:text-3xl">{nextTitle}</div>
            {nextMeta && <p className="mt-1 text-sm font-semibold text-paper/85">{nextMeta}</p>}
          </div>
          <p className="max-w-md text-sm text-paper/90 line-clamp-3">{nextDesc || nextBody}</p>
        </div>
      </Link>

      <SponsorCarousel />

      {featured && (
        <section className="border-b border-ink/15 bg-paper">
          <div className="mx-auto max-w-6xl px-4 py-8">
            <div className="flex flex-col gap-4 overflow-hidden rounded-xl border border-ink/20 bg-card/60 sm:flex-row sm:items-stretch">
              {/* Random garage photo thumbnail */}
              {garageThumb && (
                <div className="relative h-28 w-full shrink-0 overflow-hidden border-b border-ink/15 sm:h-auto sm:w-36 sm:border-b-0 sm:border-r">
                  <img
                    src={garageThumb}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
              )}

              <div className="flex flex-1 flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-5">
                <div className="flex shrink-0 items-center gap-3 sm:gap-4">
                  <div className="relative h-16 w-16 overflow-hidden rounded-full border-2 border-ink bg-ink sm:h-20 sm:w-20">
                    {faceSrc ? (
                      <img
                        src={faceSrc}
                        alt={featured.display_name ?? "Featured member"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center font-display text-xl tracking-wide text-paper sm:text-2xl">
                        {initials(featured.display_name)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 sm:hidden">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                      {lang === "af" ? "Lid in die kollig" : "Featured member"}
                    </p>
                    <p className="font-display text-xl leading-tight text-ink">
                      {featured.display_name ?? "—"}
                    </p>
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="hidden text-[10px] font-bold uppercase tracking-[0.2em] text-primary sm:block">
                    {lang === "af" ? "Lid in die kollig" : "Featured member"}
                  </p>
                  <p className="hidden font-display text-2xl leading-tight text-ink sm:block">
                    {featured.display_name ?? "—"}
                  </p>
                  <p className="mt-0.5 text-sm text-ink/65">
                    #{String(featured.member_number).padStart(4, "0")}
                    {featured.town ? ` · ${featured.town}` : ""}
                    {featured.favourite_ride ? ` · ${featured.favourite_ride}` : ""}
                  </p>
                  {featured.featured_bio && (
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink/75">
                      {featured.featured_bio}
                    </p>
                  )}
                </div>

                <Link
                  to="/members/$number"
                  params={{ number: String(featured.member_number) }}
                  className="shrink-0 self-start rounded-md border border-ink/30 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-ink/70 hover:border-ink hover:text-ink sm:self-center"
                >
                  {lang === "af" ? "Bekyk" : "View"} →
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-display text-4xl tracking-wide text-ink sm:text-5xl">
          {t("home.featuresTitle")}
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <FeatureCard
            icon={<Calendar className="h-6 w-6" />}
            title={t("home.feature1Title")}
            body={t("home.feature1Body")}
          />
          <FeatureCard
            icon={<IdCard className="h-6 w-6" />}
            title={t("home.feature2Title")}
            body={t("home.feature2Body")}
          />
          <FeatureCard
            icon={<Users className="h-6 w-6" />}
            title={t("home.feature3Title")}
            body={t("home.feature3Body")}
          />
        </div>
      </section>

      <section className="border-t-2 border-ink bg-secondary">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 md:grid-cols-2">
          <h2 className="font-display text-4xl tracking-wide text-ink sm:text-5xl">
            {t("home.aboutTitle")}
          </h2>
          <div>
            <p className="text-lg text-ink/80">{t("home.aboutBody")}</p>
            <Link
              to="/about"
              className="mt-6 inline-flex items-center rounded-md border-2 border-ink bg-paper px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-ink shadow-[3px_3px_0_0_var(--color-ink)] transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"
            >
              {t("nav.about")} →
            </Link>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}

function FeatureCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="group rounded-lg border-2 border-ink bg-card p-6 shadow-[4px_4px_0_0_var(--color-ink)] transition-transform hover:-translate-y-1">
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full border-2 border-ink bg-primary text-paper">
        {icon}
      </div>
      <h3 className="font-display text-2xl tracking-wide text-ink">{title}</h3>
      <p className="mt-2 text-ink/70">{body}</p>
    </div>
  );
}
