import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { getLatestConcoursHomeWinner } from "@/lib/concours.functions";
import { concoursImageUrl } from "@/lib/event-image-url";
import { useI18n } from "@/i18n/I18nProvider";
import { Trophy } from "lucide-react";

export function ConcoursHomeWinner() {
  const { lang } = useI18n();
  // Render only after hydration: the query result differs between the SSR pass
  // and the first client render, which caused a hydration mismatch.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const { data } = useQuery({
    queryKey: ["concours-home-winner"],
    queryFn: () => getLatestConcoursHomeWinner(),
    staleTime: 60_000,
    enabled: hydrated,
  });

  if (!hydrated || !data?.winnerPhotoUrl) return null;


  const headline =
    lang === "af" && data.winnerHeadlineAf
      ? data.winnerHeadlineAf
      : data.winnerHeadlineEn ||
        (lang === "af" ? "Concours Mini wenner" : "Concours Mini winner");

  const eventTitle =
    lang === "af" && data.eventTitleAf ? data.eventTitleAf : data.eventTitle;

  const who =
    data.taggedDisplayName ||
    data.vehicleLabel ||
    (lang === "af" ? "Die wenner" : "The winner");

  const prize =
    lang === "af" && data.prizeAf ? data.prizeAf : data.prizeEn;

  const blurb =
    (lang === "af" ? data.winnerBlurbAf || data.winnerBlurbEn : data.winnerBlurbEn) || null;


  return (
    <section className="border-b-2 border-ink bg-paper text-ink">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="overflow-hidden rounded-xl border-2 border-ink bg-card shadow-[4px_4px_0_0_var(--color-primary)] sm:flex">
          <div className="relative h-48 w-full shrink-0 border-b-2 border-ink sm:h-auto sm:w-56 sm:border-b-0 sm:border-r-2">
            <img
              src={
                data.winnerVehicleId ? concoursImageUrl(data.winnerVehicleId) : data.winnerPhotoUrl
              }
              alt=""
              className="h-full w-full object-cover"
            />
            <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full border-2 border-ink bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-paper">
              <Trophy className="h-3 w-3" />
              Concours
            </div>
          </div>
          <div className="flex flex-1 flex-col justify-center gap-2 p-4 sm:p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
              {headline}
            </p>
            <p className="font-display text-2xl leading-tight text-ink sm:text-3xl">{who}</p>
            <p className="text-sm text-ink/70">
              {eventTitle}
              {data.averageScore != null && (
                <>
                  {" · "}
                  <span className="font-bold text-ink">
                    {data.averageScore}
                    <span className="font-normal text-ink/50">
                      {" "}
                      / 10 · {data.submissionCount}{" "}
                      {lang === "af" ? "stemme" : "votes"}
                    </span>
                  </span>
                </>
              )}
            </p>
            {blurb && (
              <p className="rounded-md border-l-4 border-primary bg-primary/5 px-3 py-2 text-sm italic leading-relaxed text-ink/85">
                “{blurb}”
              </p>
            )}

            {prize && (
              <p className="text-sm font-bold text-primary">
                {lang === "af" ? "Pryse: " : "Prize: "}
                {prize}
              </p>
            )}
            <Link
              to="/events/$id"
              params={{ id: data.eventId }}
              className="mt-1 self-start rounded-md border-2 border-ink bg-paper px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-ink hover:bg-ink hover:text-paper"
            >
              {lang === "af" ? "Bekyk byeenkoms" : "View event"} →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
