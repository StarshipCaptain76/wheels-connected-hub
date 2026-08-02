import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { getLatestConcoursWinner } from "@/lib/concours.functions";

export function ConcoursHomeWinner() {
  const { lang } = useI18n();
  const { data } = useQuery({
    queryKey: ["concours", "latest-winner"],
    queryFn: () => getLatestConcoursWinner(),
    staleTime: 5 * 60_000,
  });

  if (!data || !data.vehicleLabel) return null;

  const af = lang === "af";
  const title = af ? data.eventTitleAf ?? data.eventTitle : data.eventTitle;
  const vehicle = af ? data.vehicleLabelAf ?? data.vehicleLabel : data.vehicleLabel;
  const prize = af ? data.prizeAf ?? data.prizeEn : data.prizeEn;

  return (
    <section className="border-b-2 border-ink bg-paper text-ink">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <Link
          to="/events/$eventId"
          params={{ eventId: data.eventId }}
          className="flex flex-col overflow-hidden rounded-xl border-2 border-ink bg-card shadow-[4px_4px_0_0_var(--color-ink)] sm:flex-row"
        >
          {data.photoUrl && (
            <div className="h-40 w-full shrink-0 overflow-hidden border-b-2 border-ink sm:h-auto sm:w-56 sm:border-b-0 sm:border-r-2">
              <img
                src={data.photoUrl}
                alt={vehicle ?? ""}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
          )}
          <div className="flex flex-1 flex-col gap-2 p-4 sm:p-5">
            <div className="flex items-center gap-2 font-display text-xs tracking-[0.3em] text-muted-foreground">
              <Trophy className="h-4 w-4" aria-hidden />
              {af ? "CONCOURS-WENNER" : "CONCOURS WINNER"}
            </div>
            <div className="font-display text-2xl tracking-wide">{vehicle}</div>
            <p className="text-sm text-muted-foreground">{title}</p>
            {prize && <p className="text-sm font-semibold">{prize}</p>}
            {data.averageScore != null && (
              <p className="text-sm">
                {af ? "Gemiddelde punt" : "Average score"}: {data.averageScore}
              </p>
            )}
            {data.sponsorName && (
              <p className="text-xs text-muted-foreground">
                {af ? "Geborg deur" : "Sponsored by"} {data.sponsorName}
              </p>
            )}
          </div>
        </Link>
      </div>
    </section>
  );
}
