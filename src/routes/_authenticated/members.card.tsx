import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";

import { useI18n } from "@/i18n/I18nProvider";
import { getMyProfile, type MemberProfile } from "@/lib/profile.functions";
import { listMyGarage } from "@/lib/garage.functions";
import { CACHED_PROFILE_KEY } from "@/lib/members-cache";
import { MemberCard, pickCarPhoto, pickFacePhoto } from "@/components/MemberCard";
import { DisplayBoardPreview } from "@/components/DisplayBoardPreview";
import { createMemberCardImage } from "@/lib/member-card-image";
import { downloadDisplayBoard } from "@/lib/display-board";
import { Download, WifiOff, FileDown, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/members/card")({
  head: () => ({
    meta: [
      { title: "Member card — Just Wheels Hessequa" },
      { name: "description", content: "View and save your Just Wheels Hessequa membership card." },
      { property: "og:title", content: "Member card — Just Wheels Hessequa" },
      { property: "og:description", content: "View and save your Just Wheels Hessequa membership card." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MemberCardPage,
});

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
  const [cardFile, setCardFile] = useState<File | null>(null);
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const [shareSupported, setShareSupported] = useState(false);
  const [cardMsg, setCardMsg] = useState<string | null>(null);
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

  useEffect(() => {
    if (!cardFile) {
      setCardUrl(null);
      setShareSupported(false);
      return;
    }
    const url = URL.createObjectURL(cardFile);
    setCardUrl(url);
    setShareSupported(Boolean(navigator.canShare?.({ files: [cardFile] })));
    return () => URL.revokeObjectURL(url);
  }, [cardFile]);

  async function shareCard() {
    if (!cardFile || !navigator.share) return;
    setCardMsg(null);
    try {
      await navigator.share({ files: [cardFile] });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setCardMsg(lang === "af" ? "Deel is nie beskikbaar nie. Probeer Laai af." : "Sharing is unavailable. Try Download instead.");
    }
  }

  function saveCardFile() {
    if (!cardUrl || !cardFile) return;
    const link = document.createElement("a");
    link.href = cardUrl;
    link.download = cardFile.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function downloadCard() {
    if (!profile || downloading) return;
    setDownloading(true);
    setCardMsg(null);
    try {
      setCardFile(await createMemberCardImage(profile, carPhoto, facePhoto, lang === "af"));
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
              <Button
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
              </Button>
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
        <Dialog open={!!cardFile} onOpenChange={(open) => { if (!open) setCardFile(null); }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{lang === "af" ? "Stoor lidkaart" : "Save member card"}</DialogTitle>
            </DialogHeader>
            {cardUrl && <img src={cardUrl} alt={lang === "af" ? "Jou lidkaart" : "Your member card"} className="h-auto w-full" />}
            <div className="flex flex-wrap gap-2">
              {shareSupported && <Button onClick={() => void shareCard()}><Share2 className="h-4 w-4" />{lang === "af" ? "Deel / stoor foto" : "Share / save photo"}</Button>}
              <Button variant="outline" onClick={saveCardFile} disabled={!cardUrl}><Download className="h-4 w-4" />{lang === "af" ? "Laai PNG af" : "Download PNG"}</Button>
            </div>
            {cardMsg && <p role="alert" className="text-sm text-primary">{cardMsg}</p>}
          </DialogContent>
        </Dialog>
      </section>
  );
}

