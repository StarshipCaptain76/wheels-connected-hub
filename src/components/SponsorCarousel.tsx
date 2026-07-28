import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { listSponsors, type Sponsor } from "@/lib/sponsors.functions";
import { useI18n } from "@/i18n/I18nProvider";
import { Handshake } from "lucide-react";

export function SponsorCarousel() {
  const { t, lang } = useI18n();
  const { data: sponsors = [] } = useQuery({
    queryKey: ["sponsors"],
    queryFn: () => listSponsors(),
    staleTime: 5 * 60 * 1000,
  });

  if (sponsors.length === 0) return null;

  const copies = Math.max(2, Math.ceil(8 / Math.max(sponsors.length, 1)));
  const loop: Sponsor[] = Array.from({ length: copies }, () => sponsors).flat();
  const durationSec = Math.max(20, sponsors.length * 6);

  return (
    <section className="border-y-2 border-black bg-black py-10 text-white">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/50">
              {t("sponsors.kicker")}
            </p>
            <h2 className="font-display text-3xl tracking-wide text-white sm:text-4xl">
              {t("sponsors.title")}
            </h2>
          </div>
          <Link
            to="/sponsors"
            className="hidden shrink-0 rounded-full border-2 border-white/50 px-4 py-2 text-sm font-bold uppercase tracking-wider text-white transition hover:border-primary hover:text-primary sm:inline-flex"
          >
            {t("sponsors.becomeCta")}
          </Link>
        </div>

        <div className="group/marquee relative overflow-hidden" aria-label={t("sponsors.title")}>
          <div
            className="flex w-max gap-6 animate-sponsor-marquee group-hover/marquee:[animation-play-state:paused]"
            style={{ animationDuration: `${durationSec}s` }}
          >
            {loop.map((s, i) => {
              const tagline = lang === "af" ? s.tagline_af ?? s.tagline : s.tagline;
              const inner = (
                <div className="flex h-24 w-56 shrink-0 flex-col items-center justify-center rounded-xl border-2 border-white/20 bg-white p-3 shadow-[3px_3px_0_0_rgba(0,0,0,0.35)] transition hover:-translate-y-0.5">
                  <img
                    src={s.logo_url}
                    alt={s.name}
                    loading="lazy"
                    className="max-h-12 max-w-full object-contain"
                  />
                  {tagline && (
                    <p className="mt-1 line-clamp-1 text-[10px] uppercase tracking-wider text-black/60">
                      {tagline}
                    </p>
                  )}
                </div>
              );
              return s.website_url ? (
                <a
                  key={`${s.id}-${i}`}
                  href={s.website_url}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  aria-label={s.name}
                >
                  {inner}
                </a>
              ) : (
                <div key={`${s.id}-${i}`} aria-label={s.name}>
                  {inner}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 flex justify-center sm:hidden">
          <Link
            to="/sponsors"
            className="inline-flex items-center gap-2 rounded-full border-2 border-white/50 px-4 py-2 text-sm font-bold uppercase tracking-wider text-white"
          >
            <Handshake className="h-4 w-4" /> {t("sponsors.becomeCta")}
          </Link>
        </div>
      </div>

      <style>{`
        @keyframes sponsor-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .animate-sponsor-marquee {
          animation-name: sponsor-marquee;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-sponsor-marquee {
            animation: none;
          }
        }
      `}</style>
    </section>
  );
}
