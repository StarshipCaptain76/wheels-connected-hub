import { queryOptions, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { listOpenConcoursEventIds } from "@/lib/concours.functions";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";

export const openConcoursIdsQuery = queryOptions({
  queryKey: ["concours", "open-ids"],
  queryFn: () => listOpenConcoursEventIds(),
  staleTime: 30_000,
});

export function useOpenConcoursIds(): Set<string> {
  const { data } = useQuery(openConcoursIdsQuery);
  return new Set(data ?? []);
}

const SIZE = {
  sm: "h-20 w-20 text-[13px]",
  md: "h-24 w-24 text-[15px]",
  lg: "h-28 w-28 text-[17px] sm:h-32 sm:w-32 sm:text-[19px]",
} as const;

type Props = {
  eventId: string;
  size?: keyof typeof SIZE;
  tone?: "onDark" | "onLight";
  className?: string;
};

/** Radiating sticker that jumps straight into Concours Mini scoring. */
export function VoteNowPulse({ eventId, size = "md", tone = "onDark", className }: Props) {
  const { t } = useI18n();
  const label = t("home.voteNow");
  const ring =
    tone === "onLight" ? "border-primary bg-primary/15" : "border-white bg-white/15";

  return (
    <Link
      to="/events/$id"
      params={{ id: eventId }}
      hash="concours"
      className={cn(
        "group relative z-10 inline-flex shrink-0 items-center justify-center",
        SIZE[size],
        className,
      )}
      aria-label={label}
    >
      <span className={cn("vote-now-ring", ring)} aria-hidden />
      <span className={cn("vote-now-ring vote-now-ring-delay", ring)} aria-hidden />
      <span
        className={cn(
          "vote-now-core relative z-[1] flex h-[74%] w-[74%] flex-col items-center justify-center rounded-full border-[3px] border-ink bg-primary px-1.5 text-center font-display uppercase leading-[0.85] tracking-wide text-paper shadow-[3px_3px_0_0_var(--color-ink)]",
          "transition-transform group-hover:translate-x-0.5 group-hover:translate-y-0.5 group-hover:shadow-none",
        )}
      >
        {label.split(/\s+/).map((word) => (
          <span key={word} className="block">
            {word}
          </span>
        ))}
      </span>
    </Link>
  );
}
