import { AlertTriangle } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import {
  PROFILE_FIELD_LABELS,
  profileCompletion,
  type ProfileFieldKey,
} from "@/lib/profile-completeness";

export function ProfileCompletionBanner({
  missing,
  onOpen,
}: {
  missing: ProfileFieldKey[];
  onOpen: () => void;
}) {
  const { lang } = useI18n();
  const af = lang === "af";
  if (missing.length === 0) return null;

  const pct = profileCompletion(missing);
  const names = missing.map((k) => PROFILE_FIELD_LABELS[k][af ? "af" : "en"]);

  return (
    <div className="mt-6 rounded-2xl border-2 border-primary bg-primary/5 p-5 shadow-[4px_4px_0_0_var(--color-primary)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-primary" />
            <p className="font-display text-xs tracking-[0.3em] text-primary">
              {af ? "PROFIEL ONVOLLEDIG" : "PROFILE INCOMPLETE"}
            </p>
          </div>
          <h2 className="mt-1 font-display text-2xl tracking-wide text-ink">
            {af ? `Jou profiel is ${pct}% voltooi` : `Your profile is ${pct}% complete`}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-ink/70">
            {af ? "Ons kort nog: " : "We still need: "}
            <span className="font-bold text-ink">{names.join(", ")}</span>.
          </p>
          <div className="mt-3 h-2 w-full max-w-sm overflow-hidden rounded-full border-2 border-ink bg-paper">
            <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex shrink-0 items-center gap-2 rounded-md border-2 border-ink bg-primary px-5 py-3 text-sm font-bold uppercase tracking-wider text-paper shadow-[3px_3px_0_0_var(--color-ink)] transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"
        >
          {af ? "Voltooi my profiel" : "Complete my profile"}
        </button>
      </div>
    </div>
  );
}
