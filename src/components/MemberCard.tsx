import { useI18n } from "@/i18n/I18nProvider";
import type { MemberProfile } from "@/lib/profile.functions";
import type { GarageVehicle } from "@/lib/garage.functions";
import { LOGO_URL } from "@/lib/brand";

/** Prefer primary vehicle photo, else first garage photo with a URL. */
export function pickCarPhoto(vehicles: GarageVehicle[]): string | null {
  const ordered = [
    ...vehicles.filter((v) => v.is_primary),
    ...vehicles.filter((v) => !v.is_primary),
  ];
  for (const v of ordered) {
    const hit = v.photos.find((p) => p.url);
    if (hit?.url) return hit.url;
  }
  return null;
}

/**
 * Profile face for the bottom-right circle.
 * Only skip when it is *exactly* the same URL as the car background.
 */
export function pickFacePhoto(avatarUrl: string | null, carPhoto: string | null): string | null {
  if (!avatarUrl || !avatarUrl.trim()) return null;
  if (carPhoto && avatarUrl === carPhoto) return null;
  return avatarUrl;
}

export function initials(name: string | null | undefined): string {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function MemberCard({
  profile,
  carPhoto,
  facePhoto,
  compact = false,
  ref,
}: {
  profile: MemberProfile;
  carPhoto: string | null;
  facePhoto: string | null;
  /** Smaller type scale for sidebar previews */
  compact?: boolean;
  ref?: React.Ref<HTMLElement>;
}) {
  const { t, lang } = useI18n();
  const year = new Date(profile.joined_at).getFullYear();
  const number = String(profile.member_number).padStart(4, "0");
  const faceInitials = initials(profile.display_name);

  return (
    <article
      ref={ref}
      aria-label="Just Wheels Hessequa member card"
      className="relative aspect-[85.6/53.98] w-full overflow-hidden rounded-2xl border-4 border-ink bg-ink text-paper shadow-[8px_8px_0_0_var(--color-primary)]"
    >
      {carPhoto ? (
        <img src={carPhoto} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-ink via-[#1a1210] to-[#2a1512]" />
      )}

      <div className="absolute inset-0 bg-gradient-to-r from-ink/95 via-ink/70 to-ink/20" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink/90 to-transparent" />

      <div className="relative flex h-full flex-col justify-between p-4 sm:p-5">
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <img
              src={LOGO_URL}
              alt="Just Wheels"
              className={`shrink-0 rounded-full border-2 border-paper bg-paper object-cover shadow-md ${
                compact ? "h-9 w-9" : "h-11 w-11 sm:h-12 sm:w-12"
              }`}
            />
            <div>
              <div
                className={`font-display leading-none tracking-wide ${
                  compact ? "text-base" : "text-lg sm:text-xl"
                }`}
              >
                JUST WHEELS
              </div>
              <div
                className={`tracking-[0.28em] text-primary ${compact ? "text-[9px]" : "text-[10px] sm:text-xs"}`}
              >
                HESSEQUA
              </div>
            </div>
          </div>
          <span
            className={`rounded-full border border-paper/40 bg-ink/40 px-2.5 py-0.5 font-bold uppercase tracking-widest backdrop-blur-sm ${
              compact ? "text-[8px]" : "text-[9px] sm:text-[10px]"
            }`}
          >
            {lang === "af" ? "Lidkaart" : "Member"}
          </span>
        </header>

        <div className="mt-auto max-w-[68%]">
          <p
            className={`font-display leading-[1.05] tracking-wide text-paper ${
              compact ? "text-2xl" : "text-[1.75rem] sm:text-4xl md:text-5xl"
            }`}
            style={{ textShadow: "0 2px 8px rgba(0,0,0,0.55)" }}
          >
            {profile.display_name ?? "—"}
          </p>

          <p
            className={`mt-2 font-display leading-none tracking-wider text-paper/95 ${
              compact ? "text-base" : "text-lg sm:text-2xl"
            }`}
          >
            <span
              className={`font-bold uppercase tracking-[0.2em] text-primary ${
                compact ? "text-[9px]" : "text-[10px] sm:text-xs"
              }`}
            >
              {t("card.number")}{" "}
            </span>
            #{number}
          </p>

          <p
            className={`mt-1.5 line-clamp-1 text-paper/80 ${compact ? "text-xs" : "text-sm sm:text-base"}`}
          >
            {profile.favourite_ride || t("card.noRide")}
          </p>

          <div
            className={`mt-2 flex flex-wrap gap-x-4 gap-y-1 uppercase tracking-widest text-paper/70 ${
              compact ? "text-[10px]" : "text-xs sm:text-sm"
            }`}
          >
            <span>
              {t("card.since")} {year}
            </span>
            <span className="font-semibold text-primary">{profile.membership_status}</span>
            {profile.town && <span>{profile.town}</span>}
          </div>
        </div>

        <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4">
          <div className={`relative ${compact ? "h-12 w-12" : "h-16 w-16 sm:h-20 sm:w-20"}`}>
            <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-[3px] border-paper bg-[#2a1a16] shadow-[0_4px_12px_rgba(0,0,0,0.45)]">
              {facePhoto ? (
                <img
                  src={facePhoto}
                  alt={profile.display_name ?? "Member"}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <span
                  className={`font-display tracking-wide text-paper/90 ${compact ? "text-lg" : "text-xl sm:text-2xl"}`}
                >
                  {faceInitials}
                </span>
              )}
            </div>
            <div
              className={`absolute -bottom-0.5 -right-0.5 overflow-hidden rounded-full border-2 border-paper bg-paper shadow ${
                compact ? "h-6 w-6" : "h-7 w-7 sm:h-8 sm:w-8"
              }`}
            >
              <img src={LOGO_URL} alt="" className="h-full w-full object-cover" />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
