import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getEventConcours,
  listConcoursQuestions,
  listConcoursVehicles,
  submitConcoursScore,
  addConcoursVehicle,
  deleteConcoursVehicle,
  tagConcoursVehicle,
  linkConcoursToGarage,
  listMyGaragePicks,
  getMyEventCheckIn,
  checkInToEvent,
  type ConcoursVehicle,
} from "@/lib/concours.functions";
import { concoursPhase } from "@/lib/concours-window";
import { useI18n } from "@/i18n/I18nProvider";
import { supabase } from "@/integrations/supabase/client";
import { ImageUploadField } from "@/components/ImageUploadField";
import { Trophy, ChevronLeft, ChevronRight, Check, Plus, User, X, MapPin, Loader2 } from "lucide-react";

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
  if (err && typeof err === "object" && "code" in err) {
    return lang === "af"
      ? "GPS toegang geweier of misluk — skakel liggingdienste aan."
      : "GPS denied or failed — turn on location services.";
  }
  if (err instanceof Error && err.message === "GPS_UNSUPPORTED") {
    return lang === "af"
      ? "Jou toestel ondersteun nie GPS nie."
      : "Your device does not support GPS.";
  }
  return err instanceof Error ? err.message : "GPS failed";
}

async function readGps(): Promise<{ lat: number; lng: number }> {
  if (!navigator.geolocation) {
    throw new Error("GPS_UNSUPPORTED");
  }
  const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 20_000,
      maximumAge: 30_000,
    });
  });
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
}

export function ConcoursChallenge({ eventId, eventStartsAt, eventEndsAt }: Props) {
  const { lang } = useI18n();
  const qc = useQueryClient();
  const submit = useServerFn(submitConcoursScore);
  const addVehicle = useServerFn(addConcoursVehicle);
  const removeVehicle = useServerFn(deleteConcoursVehicle);
  const tagVehicle = useServerFn(tagConcoursVehicle);
  const linkGarage = useServerFn(linkConcoursToGarage);
  const doCheckIn = useServerFn(checkInToEvent);

  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [identityReady, setIdentityReady] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [myDisplayName, setMyDisplayName] = useState<string | null>(null);
  const [myMemberNumber, setMyMemberNumber] = useState<number | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      setSignedIn(!!session);
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
      setSignedIn(!!s);
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

  const questionsQ = useQuery({
    queryKey: ["concours-questions", eventId, concoursQ.data?.selected_question_ids],
    enabled: !!concoursQ.data?.selected_question_ids?.length,
    queryFn: () =>
      listConcoursQuestions({
        data: { ids: concoursQ.data!.selected_question_ids },
      }),
  });

  const checkInQ = useQuery({
    queryKey: ["event-checkin", eventId],
    enabled: !!signedIn && !!concoursQ.data?.enabled,
    queryFn: () => getMyEventCheckIn({ data: { eventId } }),
  });

  const garagePicksQ = useQuery({
    queryKey: ["garage-picks", "me"],
    enabled: !!signedIn && isMember,
    queryFn: () => listMyGaragePicks(),
  });

  const [checkInBusy, setCheckInBusy] = useState(false);
  const [checkInErr, setCheckInErr] = useState<string | null>(null);
  const [spectatorGps, setSpectatorGps] = useState<{ lat: number; lng: number } | null>(null);

  async function handleMemberCheckIn() {
    setCheckInBusy(true);
    setCheckInErr(null);
    try {
      const pos = await readGps();
      await doCheckIn({
        data: {
          eventId,
          lat: pos.lat,
          lng: pos.lng,
        },
      });
      await qc.invalidateQueries({ queryKey: ["event-checkin", eventId] });
    } catch (err) {
      setCheckInErr(gpsErrorMessage(err, lang));
    } finally {
      setCheckInBusy(false);
    }
  }

  const checkedIn = !!checkInQ.data?.checkedIn && !checkInQ.data?.isSpectator;
  const scoringAsMember = !!isMember && checkedIn;
  const phase = useMemo(
    () => concoursPhase(eventStartsAt, eventEndsAt),
    [eventStartsAt, eventEndsAt],
  );

  const [selectedVehicle, setSelectedVehicle] = useState<ConcoursVehicle | null>(null);
  const [answers, setAnswers] = useState<Record<string, number | string | null>>({});
  const [qIdx, setQIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  // Admin: quick-add vehicle
  const [showAdd, setShowAdd] = useState(false);
  const [newPhotoUrl, setNewPhotoUrl] = useState("");
  const [addBusy, setAddBusy] = useState(false);

  // Tag flow
  const [taggingId, setTaggingId] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberHits, setMemberHits] = useState<
    Array<{ id: string; display_name: string | null; member_number: number }>
  >([]);

  const c = concoursQ.data;
  const vehicles = vehiclesQ.data ?? [];
  const allQuestions = questionsQ.data ?? [];

  const questions = useMemo(() => {
    if (scoringAsMember) return allQuestions;
    const half = Math.ceil(allQuestions.length / 2);
    return allQuestions.slice(0, half);
  }, [allQuestions, scoringAsMember]);

  if (concoursQ.isLoading) return null;
  if (!c?.enabled) return null;

  const scoringOpen = phase === "open" && !c.results_published_at;

  // Pre-event teaser
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

  async function handleAddVehicle() {
    if (!newPhotoUrl) return;
    setAddBusy(true);
    try {
      await addVehicle({
        data: {
          eventId,
          photoUrl: newPhotoUrl,
          label: null,
          labelAf: null,
        },
      });
      setNewPhotoUrl("");
      setShowAdd(false);
      await qc.invalidateQueries({ queryKey: ["concours-vehicles", eventId] });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setAddBusy(false);
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
      alert(err instanceof Error ? err.message : "Tag failed");
    } finally {
      setBusy(false);
    }
  }

  async function searchMembers(q: string) {
    setMemberSearch(q);
    if (q.trim().length < 2) {
      setMemberHits([]);
      return;
    }
    const trimmed = q.trim();
    const asNumber = Number(trimmed);
    let query = supabase
      .from("profiles")
      .select("id, display_name, member_number")
      .eq("membership_status", "active")
      .limit(8);
    if (Number.isFinite(asNumber) && asNumber > 0 && /^\d+$/.test(trimmed)) {
      query = query.eq("member_number", asNumber);
    } else {
      const safe = trimmed.replace(/[%_,.()]/g, " ").replace(/\s+/g, " ").trim();
      if (!safe) {
        setMemberHits([]);
        return;
      }
      query = query.ilike("display_name", `%${safe}%`);
    }
    const { data } = await query;
    setMemberHits(
      (data ?? []).map((r) => ({
        id: r.id as string,
        display_name: r.display_name as string | null,
        member_number: r.member_number as number,
      })),
    );
  }

  async function tagMember(
    vehicleId: string,
    m: { id: string; display_name: string | null; member_number: number },
  ) {
    setBusy(true);
    try {
      await tagVehicle({
        data: {
          vehicleId,
          taggedUserId: m.id,
          taggedDisplayName: m.display_name,
          taggedMemberNumber: m.member_number,
        },
      });
      await qc.invalidateQueries({ queryKey: ["concours-vehicles", eventId] });
      setTaggingId(null);
      setMemberSearch("");
      setMemberHits([]);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Tag failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit() {
    if (!selectedVehicle) return;
    setBusy(true);
    setDoneMsg(null);
    try {
      const payload: {
        eventId: string;
        vehicleId: string;
        answers: Record<string, number | string | null>;
        lat?: number;
        lng?: number;
        voterKey?: string;
      } = { eventId, vehicleId: selectedVehicle.id, answers };
      if (!scoringAsMember) {
        const pos = spectatorGps ?? (await readGps());
        payload.lat = pos.lat;
        payload.lng = pos.lng;
        payload.voterKey = getVoterKey();
      }
      const res = await submit({ data: payload });
      setDoneMsg(
        lang === "af"
          ? `Ingedien! Jou telling: ${res.totalScore}`
          : `Submitted! Your score: ${res.totalScore}`,
      );
      await qc.invalidateQueries({ queryKey: ["concours-vehicles", eventId] });
      setSelectedVehicle(null);
      setAnswers({});
      setQIdx(0);
    } catch (err) {
      setDoneMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  // Scoring form
  if (selectedVehicle) {
    const q = questions[qIdx];
    const text = q ? (lang === "af" && q.text_af ? q.text_af : q.text_en) : "";
    const cat = q && lang === "af" && q.category_af ? q.category_af : q?.category;

    return (
      <section className="mt-8 rounded-lg border-2 border-ink bg-card p-5">
        <button
          type="button"
          onClick={() => {
            setSelectedVehicle(null);
            setAnswers({});
            setQIdx(0);
          }}
          className="mb-3 inline-flex items-center gap-1 text-sm text-ink/60 hover:text-primary"
        >
          <ChevronLeft className="h-4 w-4" />
          {lang === "af" ? "Terug na voertuie" : "Back to vehicles"}
        </button>

        <div className="flex gap-3">
          <img
            src={selectedVehicle.photo_url}
            alt=""
            className="h-20 w-28 rounded border-2 border-ink object-cover"
          />
          <div>
            <p className="font-display text-xl text-ink">
              {selectedVehicle.tagged_display_name
                ? selectedVehicle.tagged_display_name
                : selectedVehicle.label ||
                  (lang === "af" ? "Voertuig" : "Vehicle")}
            </p>
            <p className="text-xs text-ink/60">
              {questions.length} {lang === "af" ? "vrae" : "questions"} ·{" "}
              {scoringAsMember
                ? lang === "af"
                  ? "volledige stem"
                  : "full member vote"
                : lang === "af"
                  ? "50% toeskouer-stem"
                  : "50% spectator vote"}
            </p>
          </div>
        </div>

        {q && (
          <div className="mt-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
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
                      onClick={() => setAnswers((a) => ({ ...a, [q.id]: n }))}
                      className={`h-10 w-10 rounded-md border-2 border-ink text-sm font-bold ${
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

              {(q.scoring_type === "yes_no" || q.scoring_type === "yes_no_na") && (
                <div className="flex flex-wrap gap-2">
                  {(["yes", "no"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setAnswers((a) => ({ ...a, [q.id]: v }))}
                      className={`rounded-md border-2 border-ink px-5 py-2 text-sm font-bold uppercase ${
                        answers[q.id] === v ? "bg-primary text-paper" : "bg-paper text-ink"
                      }`}
                    >
                      {v === "yes" ? (lang === "af" ? "Ja" : "Yes") : lang === "af" ? "Nee" : "No"}
                    </button>
                  ))}
                  {q.scoring_type === "yes_no_na" && (
                    <button
                      type="button"
                      onClick={() => setAnswers((a) => ({ ...a, [q.id]: "na" }))}
                      className={`rounded-md border-2 border-ink px-5 py-2 text-sm font-bold uppercase ${
                        answers[q.id] === "na" ? "bg-primary text-paper" : "bg-paper text-ink"
                      }`}
                    >
                      N/A
                    </button>
                  )}
                </div>
              )}

              {q.scoring_type === "count" && (
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={(answers[q.id] as number) ?? ""}
                  onChange={(e) =>
                    setAnswers((a) => ({
                      ...a,
                      [q.id]: e.target.value === "" ? null : Number(e.target.value),
                    }))
                  }
                  className="w-24 rounded-md border-2 border-ink bg-paper px-3 py-2"
                />
              )}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                disabled={qIdx === 0}
                onClick={() => setQIdx((i) => i - 1)}
                className="inline-flex items-center gap-1 rounded-md border-2 border-ink bg-paper px-3 py-2 text-sm font-bold disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                {lang === "af" ? "Vorige" : "Prev"}
              </button>

              {qIdx < questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setQIdx((i) => i + 1)}
                  className="inline-flex items-center gap-1 rounded-md border-2 border-ink bg-primary px-4 py-2 text-sm font-bold uppercase text-paper"
                >
                  {lang === "af" ? "Volgende" : "Next"}
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={
                    busy ||
                    !questions.every((qq) => {
                      const val = answers[qq.id];
                      return val !== undefined && val !== null && val !== "";
                    })
                  }
                  onClick={handleSubmit}
                  className="inline-flex items-center gap-1 rounded-md border-2 border-ink bg-primary px-4 py-2 text-sm font-bold uppercase text-paper disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  {busy
                    ? lang === "af"
                      ? "Stuur…"
                      : "Sending…"
                    : lang === "af"
                      ? "Dien in"
                      : "Submit score"}
                </button>
              )}
            </div>
          </div>
        )}
      </section>
    );
  }

  // Vehicle grid + admin [+]
  return (
    <section className="mt-8 rounded-lg border-2 border-ink bg-card p-5">
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

        {isAdmin && checkedIn && scoringOpen && (
          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md border-2 border-ink bg-primary px-3 py-2 text-sm font-bold uppercase tracking-wider text-paper"
            title={lang === "af" ? "Voeg voertuig by" : "Add vehicle"}
          >
            <Plus className="h-4 w-4" />
            {lang === "af" ? "Voertuig" : "Car"}
          </button>
        )}
      </div>

      {isAdmin && (
        <p className="mt-2 text-xs text-ink/60">
          {lang === "af"
            ? "Admin: druk [+] en neem ’n foto van elke kar. Geen etikette nodig nie."
            : "Admin: tap [+] and snap each car. No labels required."}
        </p>
      )}

      {showAdd && isAdmin && (
        <div className="mt-3 space-y-3 rounded-lg border-2 border-dashed border-primary/50 bg-primary/5 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-ink">
              {lang === "af" ? "Nuwe voertuig — net ’n foto" : "New vehicle — photo only"}
            </p>
            <button type="button" onClick={() => setShowAdd(false)} className="text-ink/50">
              <X className="h-4 w-4" />
            </button>
          </div>
          <ImageUploadField
            label={lang === "af" ? "Foto" : "Photo"}
            value={newPhotoUrl}
            onChange={(v) => setNewPhotoUrl(v || "")}
            bucket="gallery"
            folder={`events/concours/${eventId}`}
            maxMb={5}
          />
          <button
            type="button"
            disabled={addBusy || !newPhotoUrl}
            onClick={handleAddVehicle}
            className="rounded-md border-2 border-ink bg-primary px-4 py-2 text-sm font-bold uppercase text-paper disabled:opacity-50"
          >
            {addBusy
              ? lang === "af"
                ? "Stoor…"
                : "Saving…"
              : lang === "af"
                ? "Voeg by"
                : "Add car"}
          </button>
        </div>
      )}

      <p className="mt-3 text-sm text-ink/70">
        {phase === "after" || c.results_published_at
          ? lang === "af"
            ? "Stemming is toe. Dankie dat jy deelgeneem het."
            : "Voting is closed. Thanks for taking part."
          : isMember
            ? lang === "af"
              ? "Kies ’n voertuig en stem. Tik jou naam om jouself te tag."
              : "Pick a car and score it. Tag yourself if it’s yours."
            : lang === "af"
              ? "Kies ’n voertuig en stem met 50% van die vrae — geen aanmelding nodig nie. GPS word by indiening nagegaan."
              : "Pick a car and score with 50% of the questions — no sign-in needed. GPS is checked when you submit."}
      </p>

      {doneMsg && <p className="mt-2 text-sm font-bold text-primary">{doneMsg}</p>}

      {/* Member GPS check-in only — spectators score unsigned with GPS at submit */}
      {isMember && !checkedIn && scoringOpen && (
        <div className="mt-4 rounded-lg border-2 border-primary bg-primary/10 p-4">
          <p className="flex items-center gap-2 font-bold text-ink">
            <MapPin className="h-5 w-5 text-primary" />
            {lang === "af" ? "Teken in op die terrein" : "Check in on site"}
          </p>
          <p className="mt-1 text-sm text-ink/70">
            {lang === "af"
              ? "Lede moet GPS-verifikasie (±2 km van die bestemming) doen vir ’n volle stem."
              : "Members need GPS verification (±2 km of the venue) for a full vote."}
          </p>
          {checkInQ.data?.destinationLat == null && (
            <p className="mt-2 text-xs text-primary">
              {lang === "af"
                ? "Hierdie byeenkoms het nog geen kaartspeld nie — vra ’n admin om die bestemming te stel."
                : "This event has no map pin yet — ask an admin to set the destination."}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={checkInBusy || checkInQ.data?.destinationLat == null}
              onClick={() => void handleMemberCheckIn()}
              className="inline-flex items-center gap-2 rounded-md border-2 border-ink bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-paper disabled:opacity-50"
            >
              {checkInBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MapPin className="h-4 w-4" />
              )}
              {lang === "af" ? "Lid — teken in" : "Member — check in"}
            </button>
          </div>
          {checkInErr && <p className="mt-2 text-sm font-bold text-primary">{checkInErr}</p>}
        </div>
      )}

      {isMember && checkedIn && (
        <p className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-green-700">
          <Check className="h-3.5 w-3.5" />
          {lang === "af" ? "Lid — ingeteken op die terrein" : "Member — checked in on site"}
          {checkInQ.data?.distanceM != null ? ` · ${checkInQ.data.distanceM} m` : ""}
        </p>
      )}

      {checkInErr && !(isMember && !checkedIn && scoringOpen) && (
        <p className="mt-2 text-sm font-bold text-primary">{checkInErr}</p>
      )}

      {vehicles.length === 0 && (
        <p className="mt-4 text-sm text-ink/50">
          {lang === "af"
            ? "Nog geen voertuie nie — admins, druk [+] en begin skiet!"
            : "No cars yet — admins, hit [+] and start snapping!"}
        </p>
      )}

      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {vehicles.map((v) => (
          <li key={v.id} className="rounded-lg border-2 border-ink bg-paper p-2">
            <button
              type="button"
              onClick={() => {
                if (!scoringOpen || !identityReady) return;
                if (isMember && !checkedIn) {
                  setCheckInErr(
                    lang === "af"
                      ? "Teken eers in op die terrein om te stem."
                      : "Check in on site first to score.",
                  );
                  return;
                }
                if (!scoringAsMember) {
                  void (async () => {
                    setCheckInErr(null);
                    try {
                      const pos = await readGps();
                      setSpectatorGps(pos);
                      setSelectedVehicle(v);
                      setAnswers({});
                      setQIdx(0);
                      setDoneMsg(null);
                    } catch (err) {
                      setCheckInErr(gpsErrorMessage(err, lang));
                    }
                  })();
                  return;
                }
                setSelectedVehicle(v);
                setAnswers({});
                setQIdx(0);
                setDoneMsg(null);
              }}
              className="flex w-full gap-3 text-left"
            >
              <img
                src={v.photo_url}
                alt=""
                className="h-16 w-20 rounded border border-ink object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-ink">
                  {v.tagged_display_name ||
                    v.label ||
                    (lang === "af" ? "Voertuig" : "Vehicle")}
                </p>
                {v.garage_vehicle_id && (
                  <p className="text-[10px] font-bold uppercase text-primary">
                    {lang === "af" ? "Garage gekoppel" : "Garage linked"}
                  </p>
                )}
                {v.tagged_member_number != null && (
                  <p className="text-xs text-ink/50">#{v.tagged_member_number}</p>
                )}
                <p className="text-xs text-ink/60">
                  {v.submission_count ?? 0} {lang === "af" ? "stemme" : "scores"}
                  {c.leaderboard_revealed && v.average_score != null
                    ? ` · ${v.average_score}`
                    : ""}
                </p>
              </div>
            </button>

            {/* Tag / admin controls */}
            {(isMember || isAdmin) && (
              <div className="mt-2 border-t border-ink/10 pt-2">
                {taggingId === v.id ? (
                  <div className="space-y-2">
                    {isMember && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => claimAsMe(v.id)}
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
                              data: {
                                concoursVehicleId: v.id,
                                garageVehicleId: gid,
                              },
                            });
                            await qc.invalidateQueries({ queryKey: ["concours-vehicles", eventId] });
                            setTaggingId(null);
                          } catch (err) {
                            alert(err instanceof Error ? err.message : "Link failed");
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
                    {isAdmin && (
                      <>
                        <input
                          value={memberSearch}
                          onChange={(e) => searchMembers(e.target.value)}
                          placeholder={
                            lang === "af" ? "Soek lidnaam of #…" : "Search member name or #…"
                          }
                          className="w-full rounded border-2 border-ink bg-paper px-2 py-1 text-xs"
                        />
                        {memberHits.length > 0 && (
                          <ul className="max-h-28 overflow-y-auto rounded border border-ink/20 bg-card text-xs">
                            {memberHits.map((m) => (
                              <li key={m.id}>
                                <button
                                  type="button"
                                  onClick={() => tagMember(v.id, m)}
                                  className="w-full px-2 py-1.5 text-left hover:bg-primary/10"
                                >
                                  {m.display_name ?? "—"}{" "}
                                  <span className="text-ink/50">#{m.member_number}</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setTaggingId(null);
                        setMemberSearch("");
                        setMemberHits([]);
                      }}
                      className="text-xs text-ink/50 underline"
                    >
                      {lang === "af" ? "Kanselleer" : "Cancel"}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setTaggingId(v.id)}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <User className="h-3 w-3" />
                      {v.tagged_display_name
                        ? lang === "af"
                          ? "Verander tag"
                          : "Change tag"
                        : lang === "af"
                          ? "Tag lid"
                          : "Tag member"}
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          if (
                            !confirm(
                              lang === "af"
                                ? "Verwyder hierdie voertuig?"
                                : "Remove this vehicle?",
                            )
                          ) {
                            return;
                          }
                          setBusy(true);
                          try {
                            await removeVehicle({ data: { vehicleId: v.id } });
                            await qc.invalidateQueries({ queryKey: ["concours-vehicles", eventId] });
                          } catch (err) {
                            alert(err instanceof Error ? err.message : "Delete failed");
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
        ))}
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
