import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";

import { useI18n } from "@/i18n/I18nProvider";
import { getMyProfile, type MemberProfile } from "@/lib/profile.functions";
import { listMyGarage } from "@/lib/garage.functions";
import { CACHED_PROFILE_KEY } from "@/lib/members-cache";
import { MemberCard, pickCarPhoto, pickFacePhoto, initials } from "@/components/MemberCard";
import { DisplayBoardPreview } from "@/components/DisplayBoardPreview";
import { LOGO_URL } from "@/lib/brand";
import { downloadDisplayBoard } from "@/lib/display-board";
import { Download, WifiOff, FileDown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/members/card")({
  head: () => ({
    meta: [{ title: "Member card — Just Wheels Hessequa" }, { name: "robots", content: "noindex" }],
  }),
  component: MemberCardPage,
});

/** CR80 credit-card size at ~300 DPI for laminate print */
const PRINT_W = 1013;
const PRINT_H = 638;
const INK = "#000000";
const PAPER = "#ffffff";

function readCache(): MemberProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHED_PROFILE_KEY);
    return raw ? (JSON.parse(raw) as MemberProfile) : null;
  } catch {
    return null;
  }
}

function MemberCardPage() {
  const { t, lang } = useI18n();
  const fetchProfile = useServerFn(getMyProfile);
  const fetchGarage = useServerFn(listMyGarage);
  const [cached, setCached] = useState<MemberProfile | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [boardBusy, setBoardBusy] = useState(false);
  const [boardMsg, setBoardMsg] = useState<string | null>(null);
  const [boardMode, setBoardMode] = useState<"specs" | "story">("specs");
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

  const vehicles = garageQuery.data ?? [];
  const boardVehicle =
    vehicles.find((v) => v.is_primary && v.photos.some((p) => p.url)) ??
    vehicles.find((v) => v.photos.some((p) => p.url)) ??
    null;

  async function downloadBoard(content: "specs" | "story" = "specs") {
    if (!profile || !boardVehicle || boardBusy) return;
    setBoardBusy(true);
    setBoardMsg(null);
    try {
      const res = await downloadDisplayBoard({
        vehicle: boardVehicle,
        content,
        owner: {
          display_name: profile.display_name,
          member_number: profile.member_number,
          town: profile.town,
          avatar_url: profile.avatar_url,
        },
        lang,
      });
      if (res.lowRes) {
        setBoardMsg(
          lang === "af"
            ? "Bord afgelaai — die motorfoto is lae resolusie en mag korrelig druk."
            : "Board downloaded — the car photo is low resolution and may print grainy.",
        );
      }
    } catch (e) {
      console.error(e);
      setBoardMsg(lang === "af" ? "Bord-aflaai het misluk" : "Board download failed");
    } finally {
      setBoardBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-4xl px-3 py-4 sm:px-4 sm:py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link to="/members" className="text-xs font-bold uppercase tracking-widest text-ink/60 hover:text-ink">
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
            {profile && boardVehicle && (
              <div className="inline-flex overflow-hidden rounded-md border-2 border-ink">
                {(["specs", "story"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setBoardMode(m)}
                    aria-pressed={boardMode === m}
                    className={`px-3 py-2 text-[11px] font-bold uppercase tracking-wider ${
                      boardMode === m ? "bg-ink text-paper" : "bg-paper text-ink hover:bg-ink/5"
                    }`}
                  >
                    {m === "specs"
                      ? lang === "af"
                        ? "Spesifikasies"
                        : "Tech specs"
                      : lang === "af"
                        ? "Storie"
                        : "Story"}
                  </button>
                ))}
              </div>
            )}
            {profile && boardVehicle && (
              <button
                type="button"
                onClick={() => void downloadBoard(boardMode)}
                disabled={boardBusy}
                className="inline-flex items-center gap-2 rounded-md border-2 border-ink bg-paper px-4 py-2 text-xs font-bold uppercase tracking-wider text-ink shadow-[3px_3px_0_0_var(--color-ink)] hover:bg-ink/5 disabled:opacity-60"
              >
                <FileDown className="h-4 w-4" />
                {boardBusy
                  ? lang === "af"
                    ? "Bou…"
                    : "Building…"
                  : lang === "af"
                    ? "Vertoonbord PDF (400×600mm)"
                    : "Display board PDF (400×600mm)"}
              </button>
            )}
          </div>
        </div>

        {boardMsg && <p className="mb-4 rounded border-2 border-ink bg-ink/5 px-3 py-2 text-sm text-ink">{boardMsg}</p>}

        <p className="mb-4 text-sm text-ink/60">
          {lang === "af"
            ? "Dagmodus: wit kaart, swart teks. Agtergrond = motor · regs onder = jou gesig · links bo = klublogo."
            : "Day mode: white card, black type. Background = car · bottom-right = your face · top-left = club logo."}
        </p>

        {!profile ? (
          <p className="text-ink/60">{t("card.needSync")}</p>
        ) : (
          <div className="mx-auto w-full space-y-10">
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                {lang === "af" ? "Lidkaart" : "Member card"}
              </p>
              <div className="mx-auto w-full max-w-2xl">
                <MemberCard ref={cardRef} profile={profile} carPhoto={carPhoto} facePhoto={facePhoto} />
              </div>
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

            <div>
              <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                  {lang === "af" ? "Vertoonbord (A4 landskap)" : "Display board (A4 landscape)"}
                </p>
                {boardVehicle && (
                  <div className="inline-flex overflow-hidden rounded-md border-2 border-ink">
                    {(["specs", "story"] as const).map((m) => (
                      <button
                        key={`board-preview-${m}`}
                        type="button"
                        onClick={() => setBoardMode(m)}
                        aria-pressed={boardMode === m}
                        className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider ${
                          boardMode === m ? "bg-ink text-paper" : "bg-paper text-ink hover:bg-ink/5"
                        }`}
                      >
                        {m === "specs"
                          ? lang === "af"
                            ? "Spesifikasies"
                            : "Tech specs"
                          : lang === "af"
                            ? "Storie"
                            : "Story"}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {boardVehicle ? (
                <DisplayBoardPreview
                  vehicle={boardVehicle}
                  owner={{
                    display_name: profile.display_name,
                    member_number: profile.member_number,
                    town: profile.town,
                    avatar_url: profile.avatar_url,
                  }}
                  lang={lang === "af" ? "af" : "en"}
                  content={boardMode}
                />
              ) : (
                <div className="rounded-xl border-2 border-dashed border-ink/30 bg-ink/5 px-4 py-10 text-center text-sm text-ink/50">
                  {lang === "af"
                    ? "Voeg ’n voertuig met ’n foto by in My Garage om die vertoonbord te sien."
                    : "Add a vehicle with a photo in My Garage to preview the display board."}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
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

  const year = new Date(profile.joined_at).getFullYear();
  const name = profile.display_name ?? "—";
  const ride = profile.favourite_ride || (af ? "Geen ry gelys nie" : "No ride listed");
  const faceInitials = initials(profile.display_name);
  const slug =
    (profile.display_name || "member")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "member";

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, PRINT_W, PRINT_H);

  if (carPhoto) {
    try {
      const img = await loadImage(carPhoto);
      const scale = Math.max(PRINT_W / img.width, PRINT_H / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (PRINT_W - w) / 2, (PRINT_H - h) / 2, w, h);
    } catch {
      /* solid white bg */
    }
  }

  const grad = ctx.createLinearGradient(0, 0, PRINT_W * 0.85, 0);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.55, "rgba(255,255,255,0.92)");
  grad.addColorStop(1, "rgba(255,255,255,0.7)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, PRINT_W, PRINT_H);

  const bot = ctx.createLinearGradient(0, PRINT_H * 0.45, 0, PRINT_H);
  bot.addColorStop(0, "rgba(255,255,255,0)");
  bot.addColorStop(1, "rgba(255,255,255,1)");
  ctx.fillStyle = bot;
  ctx.fillRect(0, 0, PRINT_W, PRINT_H);

  try {
    const logo = await loadImage(LOGO_URL);
    drawCircleImage(ctx, logo, 48, 48, 36);
  } catch {
    /* skip */
  }

  ctx.fillStyle = INK;
  ctx.font = "700 28px Bebas Neue, Barlow, sans-serif";
  ctx.fillText("JUST WHEELS", 100, 52);
  ctx.font = "600 14px Barlow, sans-serif";
  ctx.fillText("HESSEQUA", 100, 74);

  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  roundRect(ctx, PRINT_W - 140, 28, 110, 28, 14);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = "700 12px Barlow, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(af ? "LIDKAART" : "MEMBER", PRINT_W - 85, 47);
  ctx.textAlign = "left";

  const nameParts = name.trim().split(/\s+/).filter(Boolean);
  const nameLine1 = (nameParts[0] ?? "—").toUpperCase();
  const nameLine2 = nameParts.length > 1 ? nameParts.slice(1).join(" ").toUpperCase() : null;
  const longest = nameLine2 && nameLine2.length > nameLine1.length ? nameLine2 : nameLine1;
  const maxNameW = PRINT_W - 120;
  let nameSize = 168;
  ctx.font = `700 ${nameSize}px Bebas Neue, Barlow, sans-serif`;
  while (ctx.measureText(longest).width > maxNameW && nameSize > 64) {
    nameSize -= 2;
    ctx.font = `700 ${nameSize}px Bebas Neue, Barlow, sans-serif`;
  }
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (nameLine2) {
    const gap = nameSize * 0.92;
    ctx.fillText(nameLine1, PRINT_W / 2, PRINT_H / 2 - gap / 2);
    ctx.fillText(nameLine2, PRINT_W / 2, PRINT_H / 2 + gap / 2);
  } else {
    ctx.fillText(nameLine1, PRINT_W / 2, PRINT_H / 2);
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  const metaLeft = 48;
  const metaBottom = PRINT_H - 32;
  const rideSize = 44;
  const townSize = 42;
  const sinceSize = 24;
  const sinceLabel = `${(af ? "Sedert" : "Since").toUpperCase()} ${year}`;

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = INK;
  ctx.font = `600 ${sinceSize}px Barlow, sans-serif`;
  if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0.1em";
  ctx.fillText(sinceLabel, metaLeft, metaBottom);
  const sinceW = ctx.measureText(sinceLabel).width;
  if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0px";

  if (profile.town) {
    ctx.font = `600 ${townSize}px Barlow, sans-serif`;
    ctx.fillText(profile.town, metaLeft + sinceW + 24, metaBottom);
  }

  ctx.font = `600 ${rideSize}px Barlow, sans-serif`;
  ctx.fillText(ride.slice(0, 42), metaLeft, metaBottom - townSize - 10);

  const cx = PRINT_W - 90;
  const cy = PRINT_H - 90;
  const r = 62;
  try {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
    ctx.fillStyle = PAPER;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.stroke();

    if (facePhoto) {
      try {
        const face = await loadImage(facePhoto);
        drawCircleImage(ctx, face, cx, cy, r);
      } catch {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = PAPER;
        ctx.fill();
        ctx.fillStyle = INK;
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
      ctx.fillStyle = PAPER;
      ctx.fill();
      ctx.fillStyle = INK;
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
    ctx.fillStyle = PAPER;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
    drawCircleImage(ctx, logo, bx, by, br);
  } catch {
    /* skip */
  }

  ctx.strokeStyle = INK;
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, PRINT_W - 10, PRINT_H - 10);

  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = `just-wheels-member-${slug}.png`;
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

function drawCircleImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement, cx: number, cy: number, r: number) {
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

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
