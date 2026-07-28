import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { useI18n } from "@/i18n/I18nProvider";
import { getMyProfile, type MemberProfile } from "@/lib/profile.functions";
import { listMyGarage, type GarageVehicle } from "@/lib/garage.functions";
import { CACHED_PROFILE_KEY } from "@/lib/members-cache";
import { LOGO_URL } from "@/lib/brand";
import { Download, WifiOff } from "lucide-react";

export const Route = createFileRoute("/_authenticated/members/card")({
  head: () => ({
    meta: [
      { title: "Member card — Just Wheels Hessequa" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MemberCardPage,
});

/** CR80 credit-card size at ~300 DPI for laminate print */
const PRINT_W = 1013;
const PRINT_H = 638;

function readCache(): MemberProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHED_PROFILE_KEY);
    return raw ? (JSON.parse(raw) as MemberProfile) : null;
  } catch {
    return null;
  }
}

/** Prefer primary vehicle photo, else first garage photo with a URL. */
function pickCarPhoto(vehicles: GarageVehicle[]): string | null {
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
 * Use profiles.avatar_url whenever set.
 * Only skip when it is *exactly* the same URL as the car background
 * (would look like a duplicated wheel crop).
 */
function pickFacePhoto(avatarUrl: string | null, carPhoto: string | null): string | null {
  if (!avatarUrl || !avatarUrl.trim()) return null;
  if (carPhoto && avatarUrl === carPhoto) return null;
  return avatarUrl;
}

function initials(name: string | null | undefined): string {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function MemberCardPage() {
  const { t, lang } = useI18n();
  const fetchProfile = useServerFn(getMyProfile);
  const fetchGarage = useServerFn(listMyGarage);
  const [cached, setCached] = useState<MemberProfile | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const cardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setCached(readCache());
    setIsOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const query = useQuery({
    queryKey: ["profile", "me"],
    queryFn: () => fetchProfile(),
    enabled: isOnline,
    retry: false,
  });

  const garageQuery = useQuery({
    queryKey: ["garage", "me"],
    queryFn: () => fetchGarage(),
    enabled: isOnline,
    retry: false,
  });

  useEffect(() => {
    if (query.data) {
      try {
        window.localStorage.setItem(CACHED_PROFILE_KEY, JSON.stringify(query.data));
      } catch {
        /* ignore */
      }
      setCached(query.data);
    }
  }, [query.data]);

  const profile = query.data ?? cached;
  const carPhoto = pickCarPhoto(garageQuery.data ?? []);
  const facePhoto = pickFacePhoto(profile?.avatar_url ?? null, carPhoto);

  async function downloadCard() {
    if (!profile || downloading) return;
    setDownloading(true);
    try {
      await downloadLandscapeCard(profile, carPhoto, facePhoto, lang === "af");
    } catch (e) {
      console.error(e);
      alert(lang === "af" ? "Aflaai het misluk" : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <SiteLayout>
      <section className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/members"
            className="text-xs font-bold uppercase tracking-widest text-ink/60 hover:text-ink"
          >
            ← {t("members.back")}
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            {!isOnline && (
              <span className="inline-flex items-center gap-1 rounded-full border-2 border-ink bg-paper px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-ink">
                <WifiOff className="h-3 w-3" /> {t("card.offline")}
              </span>
            )}
            {profile && (
              <button
                type="button"
                onClick={() => void downloadCard()}
                disabled={downloading}
                className="inline-flex items-center gap-2 rounded-md border-2 border-ink bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-paper shadow-[3px_3px_0_0_var(--color-ink)] disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                {downloading
                  ? lang === "af"
                    ? "Laai…"
                    : "Saving…"
                  : lang === "af"
                    ? "Laai af vir laminaat"
                    : "Download for laminate"}
              </button>
            )}
          </div>
        </div>

        <p className="mb-4 text-sm text-ink/60">
          {lang === "af"
            ? "Agtergrond = motor · regs onder = jou gesig (My Garage → Lidkaart-foto) · links bo = klublogo."
            : "Background = car · bottom-right = your face (My Garage → Member card photo) · top-left = club logo."}
        </p>

        {!profile ? (
          <p className="text-ink/60">{t("card.needSync")}</p>
        ) : (
          <div className="mx-auto w-full max-w-2xl">
            <MemberCard
              ref={cardRef}
              profile={profile}
              carPhoto={carPhoto}
              facePhoto={facePhoto}
            />
            {!carPhoto && (
              <p className="mt-3 text-center text-xs text-ink/50">
                {lang === "af"
                  ? "Geen garage-foto nie — laai 'n motorfoto in My Garage op."
                  : "No garage photo yet — upload a car photo in My Garage."}
              </p>
            )}
            {!facePhoto && (
              <p className="mt-2 text-center text-xs text-ink/50">
                {lang === "af"
                  ? "Geen gesigfoto nie — gaan na My Garage → Lidkaart-foto en laai jou portret op."
                  : "No face photo — go to My Garage → Member card photo and upload your portrait."}
              </p>
            )}
          </div>
        )}
      </section>
    </SiteLayout>
  );
}

function MemberCard({
  profile,
  carPhoto,
  facePhoto,
  ref,
}: {
  profile: MemberProfile;
  carPhoto: string | null;
  facePhoto: string | null;
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
      {/* Background = garage car only */}
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
              className="h-11 w-11 shrink-0 rounded-full border-2 border-paper bg-paper object-cover shadow-md sm:h-12 sm:w-12"
            />
            <div>
              <div className="font-display text-lg leading-none tracking-wide sm:text-xl">
                JUST WHEELS
              </div>
              <div className="text-[10px] tracking-[0.28em] text-primary sm:text-xs">HESSEQUA</div>
            </div>
          </div>
          <span className="rounded-full border border-paper/40 bg-ink/40 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest backdrop-blur-sm sm:text-[10px]">
            {lang === "af" ? "Lidkaart" : "Member"}
          </span>
        </header>

        {/* Name first & largest — easy to read for older members */}
        <div className="mt-auto max-w-[68%]">
          <p
            className="font-display text-[1.75rem] leading-[1.05] tracking-wide text-paper sm:text-4xl md:text-5xl"
            style={{ textShadow: "0 2px 8px rgba(0,0,0,0.55)" }}
          >
            {profile.display_name ?? "—"}
          </p>

          <p className="mt-2 font-display text-lg leading-none tracking-wider text-paper/95 sm:text-2xl">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary sm:text-xs">
              {t("card.number")}{" "}
            </span>
            #{number}
          </p>

          <p className="mt-1.5 line-clamp-1 text-sm text-paper/80 sm:text-base">
            {profile.favourite_ride || t("card.noRide")}
          </p>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs uppercase tracking-widest text-paper/70 sm:text-sm">
            <span>
              {t("card.since")} {year}
            </span>
            <span className="font-semibold text-primary">{profile.membership_status}</span>
            {profile.town && <span>{profile.town}</span>}
          </div>
        </div>

        <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4">
          <div className="relative h-16 w-16 sm:h-20 sm:w-20">
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
                <span className="font-display text-xl tracking-wide text-paper/90 sm:text-2xl">
                  {faceInitials}
                </span>
              )}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 h-7 w-7 overflow-hidden rounded-full border-2 border-paper bg-paper shadow sm:h-8 sm:w-8">
              <img src={LOGO_URL} alt="" className="h-full w-full object-cover" />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

async function downloadLandscapeCard(
  profile: MemberProfile,
  carPhoto: string | null,
  facePhoto: string | null,
  af: boolean,
) {
  const canvas = document.createElement("canvas");
  canvas.width = PRINT_W;
  canvas.height = PRINT_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");

  const number = String(profile.member_number).padStart(4, "0");
  const year = new Date(profile.joined_at).getFullYear();
  const name = profile.display_name ?? "—";
  const ride = profile.favourite_ride || (af ? "Geen ry gelys nie" : "No ride listed");
  const faceInitials = initials(profile.display_name);

  ctx.fillStyle = "#140e0c";
  ctx.fillRect(0, 0, PRINT_W, PRINT_H);

  if (carPhoto) {
    try {
      const img = await loadImage(carPhoto);
      const scale = Math.max(PRINT_W / img.width, PRINT_H / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (PRINT_W - w) / 2, (PRINT_H - h) / 2, w, h);
    } catch {
      /* solid bg */
    }
  }

  const grad = ctx.createLinearGradient(0, 0, PRINT_W * 0.75, 0);
  grad.addColorStop(0, "rgba(20,14,12,0.96)");
  grad.addColorStop(0.55, "rgba(20,14,12,0.72)");
  grad.addColorStop(1, "rgba(20,14,12,0.15)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, PRINT_W, PRINT_H);

  const bot = ctx.createLinearGradient(0, PRINT_H * 0.45, 0, PRINT_H);
  bot.addColorStop(0, "rgba(20,14,12,0)");
  bot.addColorStop(1, "rgba(20,14,12,0.88)");
  ctx.fillStyle = bot;
  ctx.fillRect(0, 0, PRINT_W, PRINT_H);

  try {
    const logo = await loadImage(LOGO_URL);
    drawCircleImage(ctx, logo, 48, 48, 36);
  } catch {
    /* skip */
  }

  ctx.fillStyle = "#f5f0e8";
  ctx.font = "700 28px Bebas Neue, Barlow, sans-serif";
  ctx.fillText("JUST WHEELS", 100, 52);
  ctx.fillStyle = "#cc2222";
  ctx.font = "600 14px Barlow, sans-serif";
  ctx.fillText("HESSEQUA", 100, 74);

  ctx.strokeStyle = "rgba(245,240,232,0.45)";
  ctx.lineWidth = 2;
  roundRect(ctx, PRINT_W - 140, 28, 110, 28, 14);
  ctx.stroke();
  ctx.fillStyle = "rgba(245,240,232,0.9)";
  ctx.font = "700 12px Barlow, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(af ? "LIDKAART" : "MEMBER", PRINT_W - 85, 47);
  ctx.textAlign = "left";

  // Name largest on print card
  ctx.fillStyle = "#f5f0e8";
  ctx.font = "700 56px Bebas Neue, Barlow, sans-serif";
  ctx.fillText(name.slice(0, 26), 48, PRINT_H - 130);

  ctx.fillStyle = "#cc2222";
  ctx.font = "600 16px Barlow, sans-serif";
  ctx.fillText(af ? "LIDNOMMER" : "MEMBER NO.", 48, PRINT_H - 95);
  ctx.fillStyle = "#f5f0e8";
  ctx.font = "700 36px Bebas Neue, Barlow, sans-serif";
  ctx.fillText(`#${number}`, 48, PRINT_H - 58);

  ctx.fillStyle = "rgba(245,240,232,0.8)";
  ctx.font = "500 18px Barlow, sans-serif";
  ctx.fillText(ride.slice(0, 40), 48, PRINT_H - 28);

  const meta = [`${af ? "Sedert" : "Since"} ${year}`, profile.membership_status, profile.town]
    .filter(Boolean)
    .join("  ·  ");
  ctx.fillStyle = "rgba(245,240,232,0.55)";
  ctx.font = "600 14px Barlow, sans-serif";
  ctx.fillText(meta, 220, PRINT_H - 58);

  const cx = PRINT_W - 90;
  const cy = PRINT_H - 90;
  const r = 62;
  try {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
    ctx.fillStyle = "#f5f0e8";
    ctx.fill();
    ctx.strokeStyle = "#140e0c";
    ctx.lineWidth = 4;
    ctx.stroke();

    if (facePhoto) {
      try {
        const face = await loadImage(facePhoto);
        drawCircleImage(ctx, face, cx, cy, r);
      } catch {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = "#2a1a16";
        ctx.fill();
        ctx.fillStyle = "#f5f0e8";
        ctx.font = "700 36px Bebas Neue, Barlow, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(faceInitials, cx, cy);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      }
    } else {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = "#2a1a16";
      ctx.fill();
      ctx.fillStyle = "#f5f0e8";
      ctx.font = "700 36px Bebas Neue, Barlow, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(faceInitials, cx, cy);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }
    ctx.restore();

    const logo = await loadImage(LOGO_URL);
    const br = 22;
    const bx = cx + r * 0.65;
    const by = cy + r * 0.65;
    ctx.beginPath();
    ctx.arc(bx, by, br + 2, 0, Math.PI * 2);
    ctx.fillStyle = "#f5f0e8";
    ctx.fill();
    ctx.strokeStyle = "#140e0c";
    ctx.lineWidth = 2;
    ctx.stroke();
    drawCircleImage(ctx, logo, bx, by, br);
  } catch {
    /* skip */
  }

  ctx.strokeStyle = "#140e0c";
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, PRINT_W - 10, PRINT_H - 10);

  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = `just-wheels-member-${number}.png`;
  a.click();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (/^https?:\/\//i.test(src) && !src.includes(window.location.host)) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

function drawCircleImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cx: number,
  cy: number,
  r: number,
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  const scale = Math.max((r * 2) / img.width, (r * 2) / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
