import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getEventConcours,
  listConcoursVehicles,
  getVehicleQuestionSet,
  listMyConcoursScores,
  submitConcoursScore,
  addConcoursVehiclesBulk,
  deleteConcoursVehicle,
  tagConcoursVehicle,
  linkConcoursToGarage,
  listMyGaragePicks,
  checkInToEvent,
  type ConcoursVehicle,
} from "@/lib/concours.functions";
import { concoursPhase } from "@/lib/concours-window";
import { concoursImageUrl } from "@/lib/event-image-url";
import { useI18n } from "@/i18n/I18nProvider";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, ChevronLeft, Check, Plus, User, X, Loader2 } from "lucide-react";

type Props = {
  eventId: string;
  eventStartsAt: string;
  eventEndsAt?: string | null;
};

function getVoterKey(): string {
  const k = "jw-concours-voter";
  try {
    let v = localStorage.getItem(k);
    if (
      !v ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
    ) {
      v = crypto.randomUUID();
      localStorage.setItem(k, v);
    }
    return v;
  } catch {
    return crypto.randomUUID();
  }
}

function gpsErrorMessage(err: unknown, lang: "en" | "af"): string {
  if (err instanceof Error && err.message === "GPS_UNSUPPORTED") {
    return lang === "af"
      ? "Jou toestel ondersteun nie GPS nie."
      : "Your device does not support GPS.";
  }
  if (err && typeof err === "object" && "code" in err) {
    return lang === "af"
      ? "GPS toegang geweier — skakel liggingdienste aan om te stem."
      : "Location denied — turn on location services to score.";
  }
  return err instanceof Error ? err.message : "GPS failed";
}

async function readGps(): Promise<{ lat: number; lng: number }> {
  if (!navigator.geolocation) throw new Error("GPS_UNSUPPORTED");
  const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 20_000,
      maximumAge: 60_000,
    });
  });
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
}

export function ConcoursChallenge({ eventId, eventStartsAt, eventEndsAt }: Props) {
  const { lang } = useI18n();
  const qc = useQueryClient();
  const submit = useServerFn(submitConcoursScore);
  const addVehicles = useServerFn(addConcoursVehiclesBulk);
  const removeVehicle = useServerFn(deleteConcoursVehicle);
  const tagVehicle = useServerFn(tagConcoursVehicle);
  const linkGarage = useServerFn(linkConcoursToGarage);
  const doCheckIn = useServerFn(checkInToEvent);

  const [identityReady, setIdentityReady] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [myDisplayName, setMyDisplayName] = useState<string | null>(null);
  const [myMemberNumber, setMyMemberNumber] = useState<number | null>(null);

  const [voterKey, setVoterKey] = useState<string | null>(null);
  useEffect(() => setVoterKey(getVoterKey()), []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      if (!session?.user) {
        setIdentityReady(true);
        return;
      }
      setMyUserId(session.user.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("membership_status, display_name, member_number")
        .eq("id", session.user.id)
        .maybeSingle();
      setIsMember(
        profile?.membership_status === "active" || profile?.membership_status === "member",
      );
      setMyDisplayName(profile?.display_name ?? null);
      setMyMemberNumber(profile?.member_number ?? null);
      const { data: admin } = await supabase.rpc("has_role", {
        _user_id: session.user.id,
        _role: "admin",
      });
      setIsAdmin(!!admin);
      setIdentityReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!s) {
        setIsMember(false);
        setIsAdmin(false);
        setMyUserId(null);
        setIdentityReady(true);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const concoursQ = useQuery({
    queryKey: ["concours", eventId],
    queryFn: () => getEventConcours({ data: { eventId } }),
  });

  const vehiclesQ = useQuery({
    queryKey: ["concours-vehicles", eventId],
    enabled: !!concoursQ.data?.enabled,
    queryFn: () => listConcoursVehicles({ data: { eventId } }),
    refetchInterval: concoursQ.data?.leaderboard_revealed ? 15_000 : false,
  });

  const myScoresQ = useQuery({
    queryKey: ["concours-my-scores", eventId, myUserId ?? voterKey],
    enabled: !!concoursQ.data?.enabled && !!voterKey && identityReady,
    queryFn: () => listMyConcoursScores({ data: { eventId, voterKey: voterKey! } }),
  });

  const garagePicksQ = useQuery({
    queryKey: ["garage-picks", "me"],
    enabled: isMember,
    queryFn: () => listMyGaragePicks(),
  });

  const phase = useMemo(
    () => concoursPhase(eventStartsAt, eventEndsAt),
    [eventStartsAt, eventEndsAt],
  );

  const [selectedVehicle, setSelectedVehicle] = useState<ConcoursVehicle | null>(null);
  const [memberMode, setMemberMode] = useState(false);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [answers, setAnswers] = useState<Record<string, number | string | null>>({});
  const [qIdx, setQIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [prepId, setPrepId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [taggingId, setTaggingId] = useState<string | null>(null);
  const [justScored, setJustScored] = useState<string[]>([]);
  const gridRef = useRef<HTMLDivElement | null>(null);

  // Admin bulk add
  const [addBusy, setAddBusy] = useState(false);
  const [addProgress, setAddProgress] = useState<string | null>(null);

  const questionSetQ = useQuery({
    queryKey: ["concours-qset", eventId, selectedVehicle?.id, memberMode],
    enabled: !!selectedVehicle,
    staleTime: 5 * 60_000,
    queryFn: () =>
      getVehicleQuestionSet({
        data: { eventId, vehicleId: selectedVehicle!.id, full: memberMode },
      }),
  });

  const c = concoursQ.data;
  const vehicles = vehiclesQ.data ?? [];
  const scoredIds = useMemo(
    () => new Set([...(myScoresQ.data ?? []), ...justScored]),
    [myScoresQ.data, justScored],
  );

  if (concoursQ.isLoading) return null;
  if (!c?.enabled) return null;

  const scoringOpen = phase === "open" && !c.results_published_at;

  if (phase === "before") {
    return (
      <section className="mt-8 rounded-lg border-2 border-primary/50 bg-primary/5 p-5">
        <h2 className="flex items-center gap-2 font-display text-2xl text-ink">
          <Trophy className="h-6 w-6 text-primary" />
          Concours Mini
        </h2>
        <p className="mt-2 text-sm text-ink/80">
          {lang === "af"
            ? "Daar is ’n ligte, snaakse Concours-uitdaging op die dag self. Kom kyk, lag en stem!"
            : "There’ll be a light, tongue-in-cheek Concours challenge on the day. Come look, laugh and score!"}
        </p>
        {(c.prize_en || c.prize_af) && (
          <p className="mt-2 text-sm font-bold text-primary">
            {lang === "af" && c.prize_af ? c.prize_af : c.prize_en}
          </p>
        )}
        {c.sponsor_name && (
          <p className="mt-1 text-xs text-ink/60">
            {lang === "af" ? "Geborg deur" : "Sponsored by"} {c.sponsor_name}
          </p>
        )}
      </section>
    );
  }

  async function handleBulkUpload(files: FileList | null) {
    const list = files ? Array.from(files) : [];
    if (list.length === 0) return;
    setAddBusy(true);
    setMsg(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      if (!userId) throw new Error("Not signed in");

      let done = 0;
      setAddProgress(`0/${list.length}`);
      const urls = await Promise.all(
        list.map(async (file) => {
          const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
          const path = `events/concours/${eventId}/${userId}/${crypto.randomUUID()}.${ext || "jpg"}`;
          const { error } = await supabase.storage
            .from("gallery")
            .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
          if (error) throw error;
          done += 1;
          setAddProgress(`${done}/${list.length}`);
          return supabase.storage.from("gallery").getPublicUrl(path).data.publicUrl;
        }),
      );

      await addVehicles({ data: { eventId, photoUrls: urls } });
      await qc.invalidateQueries({ queryKey: ["concours-vehicles", eventId] });
      setMsg(
        lang === "af" ? `${urls.length} karre bygevoeg.` : `Added ${urls.length} cars.`,
      );
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setAddProgress(null);
      setAddBusy(false);
    }
  }

  async function openVehicle(v: ConcoursVehicle) {
    if (!scoringOpen || !identityReady || busy || prepId) return;
    if (scoredIds.has(v.id)) {
      setMsg(lang === "af" ? "Jy het hierdie kar reeds gestem." : "You’ve already scored this car.");
      return;
    }
    setPrepId(v.id);
    setMsg(null);
    try {
      let pos = gps;
      if (!pos) {
        try {
          pos = await readGps();
        } catch (err) {
          if (!isAdmin) throw err;
          pos = null;
        }
      }
      if (pos) setGps(pos);
      let asMember = false;
      if (isMember || isAdmin) {
        try {
          await doCheckIn({
            data: { eventId, lat: pos?.lat ?? 0, lng: pos?.lng ?? 0 },
          });
          asMember = true;
        } catch {
          asMember = isAdmin;
        }
      }
      setMemberMode(asMember);
      setAnswers({});
      setQIdx(0);
      setSelectedVehicle(v);
    } catch (err) {
      setMsg(gpsErrorMessage(err, lang));
    } finally {
      setPrepId(null);
    }
  }

  function closeSheet() {
    setSelectedVehicle(null);
    setAnswers({});
    setQIdx(0);
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  async function finish(all: Record<string, number | string | null>) {
    if (!selectedVehicle || busy) return;
    const vehicleId = selectedVehicle.id;
    setBusy(true);
    try {
      const res = await submit({
        data: {
          eventId,
          vehicleId,
          answers: all,
          ...(gps ? { lat: gps.lat, lng: gps.lng } : {}),
          ...(voterKey ? { voterKey } : {}),
        },
      });
      setJustScored((ids) => (ids.includes(vehicleId) ? ids : [...ids, vehicleId]));
      setMsg(
        lang === "af"
          ? `Ingedien! Jou telling: ${res.totalScore}`
          : `Submitted! Your score: ${res.totalScore}`,
      );
      closeSheet();
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["concours-vehicles", eventId] }),
        qc.invalidateQueries({ queryKey: ["concours-my-scores", eventId] }),
      ]);
    } catch (err) {
      if (err instanceof Error && /already scored/i.test(err.message)) {
        setJustScored((ids) => (ids.includes(vehicleId) ? ids : [...ids, vehicleId]));
        closeSheet();
      }
      setMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  function answer(questionId: string, value: number | string, total: number) {
    const next = { ...answers, [questionId]: value };
    setAnswers(next);
    if (qIdx < total - 1) {
      setQIdx((i) => i + 1);
    } else {
      void finish(next);
    }
  }

  async function claimAsMe(vehicleId: string) {
    if (!myUserId) return;
    setBusy(true);
    try {
      await tagVehicle({
        data: {
          vehicleId,
          taggedUserId: myUserId,
          taggedDisplayName: myDisplayName,
          taggedMemberNumber: myMemberNumber,
        },
      });
      await qc.invalidateQueries({ queryKey: ["concours-vehicles", eventId] });
      setTaggingId(null);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Tag failed");
    } finally {
      setBusy(false);
    }
  }

  // ---------- Scoring sheet ----------
  if (selectedVehicle) {
    const questions = questionSetQ.data ?? [];
    const q = questions[qIdx];
    const text = q ? (lang === "af" && q.text_af ? q.text_af : q.text_en) : "";
    const cat = q && lang === "af" && q.category_af ? q.category_af : q?.category;

    return (
      <section className="mt-8 rounded-lg border-2 border-ink bg-card p-5">
        <button
          type="button"
          onClick={closeSheet}
          className="mb-3 inline-flex items-center gap-1 text-sm text-ink/60 hover:text-primary"
        >
          <ChevronLeft className="h-4 w-4" />
          {lang === "af" ? "Terug na voertuie" : "Back to cars"}
        </button>

        <div className="flex gap-3">
          <img
            src={concoursImageUrl(selectedVehicle.id)}
            alt=""
            loading="lazy"
            className="h-20 w-28 rounded border-2 border-ink object-cover"
          />
          <div>
            <p className="font-display text-xl text-ink">
              {selectedVehicle.tagged_display_name ||
                selectedVehicle.label ||
                (lang === "af" ? "Voertuig" : "Vehicle")}
            </p>
            <p className="text-xs text-ink/60">
              {memberMode
                ? lang === "af"
                  ? "Volledige lid-stem"
                  : "Full member vote"
                : lang === "af"
                  ? "Toeskouer-stem (50%)"
                  : "Spectator vote (50%)"}
            </p>
          </div>
        </div>

        {questionSetQ.isLoading && (
          <p className="mt-6 inline-flex items-center gap-2 text-sm text-ink/60">
            <Loader2 className="h-4 w-4 animate-spin" />
            {lang === "af" ? "Laai vrae…" : "Loading questions…"}
          </p>
        )}

        {q && (
          <div className="mt-5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${((qIdx + (busy ? 1 : 0)) / questions.length) * 100}%` }}
              />
            </div>
            <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-primary">
              {cat} · {qIdx + 1}/{questions.length}
            </p>
            <p className="mt-1 text-lg font-bold text-ink">{text}</p>

            <div className="mt-4">
              {q.scoring_type === "scale_1_10" && (
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      disabled={busy}
                      onClick={() => answer(q.id, n, questions.length)}
                      className={`h-11 w-11 rounded-md border-2 border-ink text-sm font-bold ${
                        answers[q.id] === n
                          ? "bg-primary text-paper"
                          : "bg-paper text-ink hover:bg-ink hover:text-paper"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}

              {(q.scoring_type === "yes_no" ||
                q.scoring_type === "yes_no_na" ||
                q.scoring_type === "count") && (
                <div className="flex flex-wrap gap-2">
                  {(["yes", "no"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      disabled={busy}
                      onClick={() => answer(q.id, v, questions.length)}
                      className={`rounded-md border-2 border-ink px-6 py-3 text-sm font-bold uppercase ${
                        answers[q.id] === v ? "bg-primary text-paper" : "bg-paper text-ink"
                      }`}
                    >
                      {v === "yes" ? (lang === "af" ? "Ja" : "Yes") : lang === "af" ? "Nee" : "No"}
                    </button>
                  ))}
                  {q.scoring_type === "yes_no_na" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => answer(q.id, "na", questions.length)}
                      className={`rounded-md border-2 border-ink px-6 py-3 text-sm font-bold uppercase ${
                        answers[q.id] === "na" ? "bg-primary text-paper" : "bg-paper text-ink"
                      }`}
                    >
                      N/A
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                disabled={qIdx === 0 || busy}
                onClick={() => setQIdx((i) => i - 1)}
                className="inline-flex items-center gap-1 rounded-md border-2 border-ink bg-paper px-3 py-2 text-sm font-bold disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                {lang === "af" ? "Vorige" : "Back"}
              </button>
              {busy && (
                <span className="inline-flex items-center gap-2 text-sm font-bold text-primary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {lang === "af" ? "Stuur…" : "Sending…"}
                </span>
              )}
            </div>
          </div>
        )}
      </section>
    );
  }

  // ---------- Car grid ----------
  return (
    <section ref={gridRef} className="mt-8 rounded-lg border-2 border-ink bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-2xl text-ink">
            <Trophy className="h-6 w-6 text-primary" />
            Concours Mini
          </h2>
          {(c.prize_en || c.prize_af) && (
            <p className="mt-1 text-sm font-bold text-primary">
              {lang === "af" && c.prize_af ? c.prize_af : c.prize_en}
            </p>
          )}
        </div>

        {isAdmin && scoringOpen && (
          <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border-2 border-ink bg-primary px-3 py-2 text-sm font-bold uppercase tracking-wider text-paper">
            {addBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {addBusy
              ? (addProgress ?? "…")
              : lang === "af"
                ? "Karre byvoeg"
                : "Add cars"}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={addBusy}
              onChange={(e) => {
                void handleBulkUpload(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>

      {scoringOpen && vehicles.length > 0 && (
        <div className="mt-4 rounded-lg border-2 border-ink bg-primary p-4 text-paper shadow-[4px_4px_0_0_var(--color-ink)]">
          <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-paper/70 bg-paper/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-paper" />
            {lang === "af" ? "Stemming is nou oop" : "Scoring is open now"}
          </span>
          <p className="mt-2 font-display text-2xl leading-tight sm:text-3xl">
            {allScored
              ? lang === "af"
                ? "Jy het al die karre gepunt!"
                : "You’ve scored every car!"
              : lang === "af"
                ? "Punte gee vir die karre"
                : "Score the cars"}
          </p>
          <p className="mt-1 text-sm text-paper/85">
            {scoredCount} / {vehicles.length}{" "}
            {lang === "af" ? "karre gepunt" : "cars scored"}
            {!isMember && (
              <>
                {" · "}
                {lang === "af"
                  ? "toeskouers kan ook stem"
                  : "spectators can vote too"}
              </>
            )}
          </p>
          {!allScored && (
            <button
              type="button"
              disabled={!!prepId}
              onClick={() => {
                const next = vehicles.find((v) => !scoredIds.has(v.id));
                if (next) void openVehicle(next);
              }}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border-2 border-ink bg-paper px-5 py-4 font-display text-xl uppercase tracking-wide text-ink transition hover:bg-ink hover:text-paper disabled:opacity-60 sm:w-auto"
            >
              {prepId ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Trophy className="h-5 w-5" />
              )}
              {scoredCount > 0
                ? lang === "af"
                  ? "Gaan voort met punte"
                  : "Continue scoring"
                : lang === "af"
                  ? "Begin punte gee"
                  : "Start scoring"}
            </button>
          )}
          <p className="mt-2 text-xs text-paper/75">
            {lang === "af"
              ? "Ons vra net een keer vir jou ligging."
              : "We only ask for your location once."}
          </p>
        </div>
      )}

      <p className="mt-3 text-sm text-ink/70">
        {phase === "after" || c.results_published_at
          ? lang === "af"
            ? "Stemming is toe. Dankie dat jy deelgeneem het."
            : "Voting is closed. Thanks for taking part."
          : lang === "af"
            ? "Tik ’n kar en beantwoord die vrae — dit stoor outomaties as jy klaar is."
            : "Tap a car and answer the questions — it saves itself when you finish."}
      </p>


      {isAdmin && (
        <p className="mt-1 text-xs text-ink/60">
          {lang === "af"
            ? "Admin: kies meerdere foto’s gelyk — geen etikette of tags nodig nie."
            : "Admin: pick several photos at once — no labels or tagging needed."}
        </p>
      )}

      {msg && <p className="mt-2 text-sm font-bold text-primary">{msg}</p>}

      {vehicles.length === 0 && (
        <p className="mt-4 text-sm text-ink/50">
          {lang === "af"
            ? "Nog geen voertuie nie — admins, druk [+] en begin skiet!"
            : "No cars yet — admins, hit [+] and start snapping!"}
        </p>
      )}

      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {vehicles.map((v) => {
          const scored = scoredIds.has(v.id);
          return (
            <li
              key={v.id}
              className={`rounded-lg border-2 border-ink bg-paper p-2 ${scored ? "opacity-70" : ""}`}
            >
              <button
                type="button"
                disabled={!scoringOpen || scored || prepId === v.id}
                onClick={() => void openVehicle(v)}
                className="flex w-full gap-3 text-left disabled:cursor-default"
              >
                <div className="relative h-16 w-20 shrink-0">
                  <img
                    src={concoursImageUrl(v.id)}
                    alt=""
                    loading="lazy"
                    className="h-full w-full rounded border border-ink object-cover"
                  />
                  {scored && (
                    <span className="absolute -right-1.5 -top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-ink bg-primary text-paper">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                  {prepId === v.id && (
                    <span className="absolute inset-0 inline-flex items-center justify-center rounded bg-ink/50 text-paper">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-ink">
                    {v.tagged_display_name || v.label || (lang === "af" ? "Voertuig" : "Vehicle")}
                  </p>
                  {v.tagged_member_number != null && (
                    <p className="text-xs text-ink/50">#{v.tagged_member_number}</p>
                  )}
                  <p className="text-xs text-ink/60">
                    {scored
                      ? lang === "af"
                        ? "Gestem ✓"
                        : "Scored ✓"
                      : `${v.submission_count ?? 0} ${lang === "af" ? "stemme" : "scores"}`}
                    {c.leaderboard_revealed && v.average_score != null ? ` · ${v.average_score}` : ""}
                  </p>
                </div>
              </button>

              {(isMember || isAdmin) && (
                <div className="mt-2 border-t border-ink/10 pt-2">
                  {taggingId === v.id ? (
                    <div className="space-y-2">
                      {isMember && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void claimAsMe(v.id)}
                          className="inline-flex items-center gap-1 rounded border-2 border-ink bg-primary px-2 py-1 text-xs font-bold uppercase text-paper"
                        >
                          <User className="h-3 w-3" />
                          {lang === "af" ? "Dis myne" : "This is mine"}
                        </button>
                      )}
                      {isMember && (garagePicksQ.data?.length ?? 0) > 0 && (
                        <select
                          className="w-full rounded border-2 border-ink bg-paper px-2 py-1 text-xs"
                          defaultValue=""
                          onChange={async (e) => {
                            const gid = e.target.value || null;
                            setBusy(true);
                            try {
                              await linkGarage({
                                data: { concoursVehicleId: v.id, garageVehicleId: gid },
                              });
                              await qc.invalidateQueries({
                                queryKey: ["concours-vehicles", eventId],
                              });
                              setTaggingId(null);
                            } catch (err) {
                              setMsg(err instanceof Error ? err.message : "Link failed");
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          <option value="">
                            {lang === "af" ? "— Koppel aan my garage —" : "— Link to my garage —"}
                          </option>
                          {(garagePicksQ.data ?? []).map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.label}
                            </option>
                          ))}
                        </select>
                      )}
                      <button
                        type="button"
                        onClick={() => setTaggingId(null)}
                        className="inline-flex items-center gap-1 text-xs text-ink/50 underline"
                      >
                        <X className="h-3 w-3" />
                        {lang === "af" ? "Kanselleer" : "Cancel"}
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      {isMember && (
                        <button
                          type="button"
                          onClick={() => setTaggingId(v.id)}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <User className="h-3 w-3" />
                          {v.tagged_display_name
                            ? lang === "af"
                              ? "Verander"
                              : "Change"
                            : lang === "af"
                              ? "Dis myne"
                              : "This is mine"}
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={async () => {
                            if (
                              !confirm(
                                lang === "af" ? "Verwyder hierdie voertuig?" : "Remove this car?",
                              )
                            ) {
                              return;
                            }
                            setBusy(true);
                            try {
                              await removeVehicle({ data: { vehicleId: v.id } });
                              await qc.invalidateQueries({
                                queryKey: ["concours-vehicles", eventId],
                              });
                            } catch (err) {
                              setMsg(err instanceof Error ? err.message : "Delete failed");
                            } finally {
                              setBusy(false);
                            }
                          }}
                          className="text-xs text-primary hover:underline"
                        >
                          {lang === "af" ? "Verwyder" : "Remove"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {c.leaderboard_revealed && (
        <div className="mt-6">
          <h3 className="font-display text-xl text-ink">
            {lang === "af" ? "Ranglys" : "Leaderboard"}
          </h3>
          <ol className="mt-2 space-y-1">
            {[...vehicles]
              .filter((v) => v.average_score != null)
              .sort((a, b) => (b.average_score ?? 0) - (a.average_score ?? 0))
              .map((v, i) => (
                <li
                  key={v.id}
                  className="flex items-center justify-between rounded border-2 border-ink bg-paper px-3 py-2 text-sm"
                >
                  <span>
                    <span className="mr-2 font-bold text-primary">#{i + 1}</span>
                    {v.tagged_display_name || v.label || (lang === "af" ? "Voertuig" : "Vehicle")}
                  </span>
                  <span className="font-bold">
                    {v.average_score}
                    <span className="ml-1 text-xs font-normal text-ink/50">
                      ({v.submission_count})
                    </span>
                  </span>
                </li>
              ))}
          </ol>
        </div>
      )}
    </section>
  );
}
