import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { getLatestConcoursHomeWinner } from "@/lib/concours.functions";
import { useI18n } from "@/i18n/I18nProvider";
import { Trophy } from "lucide-react";

export function ConcoursHomeWinner() {
  const { lang } = useI18n();
  const { data } = useQuery({
    queryKey: ["concours-home-winner"],
    queryFn: () => getLatestConcoursHomeWinner(),
    staleTime: 60_000,
  });

  if (!data?.winnerPhotoUrl) return null;

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

  return (
    <section className="border-b-2 border-ink bg-paper text-ink">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="overflow-hidden rounded-xl border-2 border-ink bg-card shadow-[4px_4px_0_0_var(--color-primary)] sm:flex">
          <div className="relative h-48 w-full shrink-0 border-b-2 border-ink sm:h-auto sm:w-56 sm:border-b-0 sm:border-r-2">
            <img
              src={data.winnerPhotoUrl}
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
