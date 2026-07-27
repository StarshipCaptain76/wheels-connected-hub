import { useEffect, useRef, useState } from "react";
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

  const trackRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  // Duplicate list for seamless marquee loop
  const loop: Sponsor[] = sponsors.length > 0 ? [...sponsors, ...sponsors] : [];

  useEffect(() => {
    const el = trackRef.current;
    if (!el || loop.length === 0 || paused) return;
    let raf = 0;
    let last = performance.now();
    const speed = 30; // px/sec
    const step = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      el.scrollLeft += speed * dt;
      // Reset when we've scrolled past half (the duplicate midpoint)
      if (el.scrollLeft >= el.scrollWidth / 2) el.scrollLeft = 0;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [loop.length, paused]);

  if (sponsors.length === 0) return null;

  return (
    <section className="border-y-2 border-ink bg-steel/10 py-10">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink/60">
              {t("sponsors.kicker")}
            </p>
            <h2 className="font-display text-3xl tracking-wide text-ink sm:text-4xl">
              {t("sponsors.title")}
            </h2>
          </div>
          <Link
            to="/sponsors"
            className="hidden shrink-0 rounded-full border-2 border-ink px-4 py-2 text-sm font-bold uppercase tracking-wider text-ink transition hover:bg-ink hover:text-paper sm:inline-flex"
          >
            {t("sponsors.becomeCta")}
          </Link>
        </div>

        <div
          ref={trackRef}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onTouchStart={() => setPaused(true)}
          onTouchEnd={() => setPaused(false)}
          className="flex gap-6 overflow-x-hidden"
          aria-label={t("sponsors.title")}
        >
          {loop.map((s, i) => {
            const tagline = lang === "af" ? s.tagline_af ?? s.tagline : s.tagline;
            const inner = (
              <div className="flex h-24 w-56 shrink-0 flex-col items-center justify-center rounded-xl border-2 border-ink bg-paper p-3 shadow-[3px_3px_0_0_hsl(var(--ink))] transition hover:-translate-y-0.5">
                <img
                  src={s.logo_url}
                  alt={s.name}
                  loading="lazy"
                  className="max-h-12 max-w-full object-contain"
                />
                {tagline && (
                  <p className="mt-1 line-clamp-1 text-[10px] uppercase tracking-wider text-ink/60">
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

        <div className="mt-6 flex justify-center sm:hidden">
          <Link
            to="/sponsors"
            className="inline-flex items-center gap-2 rounded-full border-2 border-ink px-4 py-2 text-sm font-bold uppercase tracking-wider text-ink"
          >
            <Handshake className="h-4 w-4" /> {t("sponsors.becomeCta")}
          </Link>
        </div>
      </div>
    </section>
  );
}
