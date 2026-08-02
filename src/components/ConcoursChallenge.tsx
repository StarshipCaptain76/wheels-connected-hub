import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getEventConcours,
  listConcoursQuestions,
  listConcoursVehicles,
  submitConcoursScore,
  addConcoursVehicle,
  tagConcoursVehicle,
  getMyEventCheckIn,
  checkInToEvent,
  type ConcoursVehicle,
} from "@/lib/concours.functions";
import { useI18n } from "@/i18n/I18nProvider";
import { supabase } from "@/integrations/supabase/client";
import { ImageUploadField } from "@/components/ImageUploadField";
import { Trophy, ChevronLeft, ChevronRight, Check, Plus, User, X, MapPin, Loader2 } from "lucide-react";

type Props = {
  eventId: string;
  eventStartsAt: string;
};

export function ConcoursChallenge({ eventId, eventStartsAt }: Props) {
  const { lang } = useI18n();
  const qc = useQueryClient();
  const submit = useServerFn(submitConcoursScore);
  const addVehicle = useServerFn(addConcoursVehicle);
  const tagVehicle = useServerFn(tagConcoursVehicle);
  const doCheckIn = useServerFn(checkInToEvent);

  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [myDisplayName, setMyDisplayName] = useState<string | null>(null);
  const [myMemberNumber, setMyMemberNumber] = useState<number | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      setSignedIn(!!session);
      if (!session?.user) return;
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
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
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

  const [checkInBusy, setCheckInBusy] = useState(false);
  const [checkInErr, setCheckInErr] = useState<string | null>(null);

  async function handleCheckIn(asSpectator: boolean) {
    setCheckInBusy(true);
    setCheckInErr(null);
    try {
      if (!navigator.geolocation) {
        throw new Error(
          lang === "af"
            ? "Jou toestel ondersteun nie GPS nie."
            : "Your device does not support GPS.",
        );
      }
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 20_000,
          maximumAge: 30_000,
        });
      });
      await doCheckIn({
        data: {
          eventId,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          isSpectator: asSpectator,
        },
      });
      await qc.invalidateQueries({ queryKey: ["event-checkin", eventId] });
    } catch (err) {
      const msg =
        err && typeof err === "object" && "code" in err
          ? lang === "af"
            ? "GPS toegang geweier of misluk — skakel liggingdienste aan."
            : "GPS denied or failed — turn on location services."
          : err instanceof Error
            ? err.message
            : "Check-in failed";
      setCheckInErr(msg);
    } finally {
      setCheckInBusy(false);
    }
  }

  const checkedIn = !!checkInQ.data?.checkedIn;
  const isSpectator = !!checkInQ.data?.isSpectator;
  // Spectators always get half the questions
  const scoringAsMember = isMember && checkedIn && !isSpectator;

  const isEventDay = useMemo(() => {
    const start = new Date(eventStartsAt);
    const now = new Date();
    return (
      start.getFullYear() === now.getFullYear() &&
      start.getMonth() === now.getMonth() &&
      start.getDate() === now.getDate()
    );
  }, [eventStartsAt]);

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

  // Pre-event teaser
  if (!isEventDay) {
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
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, member_number")
      .or(`display_name.ilike.%${q}%,member_number.eq.${Number(q) || 0}`)
      .eq("membership_status", "active")
      .limit(8);
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
      const res = await submit({
        data: { eventId, vehicleId: selectedVehicle.id, answers },
      });
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
                  max={50}
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
                  disabled={busy}
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

        {isAdmin && checkedIn && (
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
        {lang === "af"
          ? isMember
            ? "Kies ’n voertuig en stem. Tik jou naam om jouself te tag."
            : "Kies ’n voertuig en stem met 50% van die vrae."
          : isMember
            ? "Pick a car and score it. Tag yourself if it’s yours."
            : "Pick a car and score with 50% of the questions."}
      </p>

      {doneMsg && <p className="mt-2 text-sm font-bold text-primary">{doneMsg}</p>}

      {/* GPS check-in gate */}
      {!checkedIn && (
        <div className="mt-4 rounded-lg border-2 border-primary bg-primary/10 p-4">
          <p className="flex items-center gap-2 font-bold text-ink">
            <MapPin className="h-5 w-5 text-primary" />
            {lang === "af" ? "Teken in op die terrein" : "Check in on site"}
          </p>
          <p className="mt-1 text-sm text-ink/70">
            {lang === "af"
              ? "GPS-verifikasie (±2 km van die bestemming) is nodig om te stem. Kies lid of toeskouer."
              : "GPS verification (±2 km of the venue) is required to score. Choose member or spectator."}
          </p>
          {checkInQ.data?.destinationLat == null && (
            <p className="mt-2 text-xs text-primary">
              {lang === "af"
                ? "Hierdie byeenkoms het nog geen kaartspeld nie — vra ’n admin om die bestemming te stel."
                : "This event has no map pin yet — ask an admin to set the destination."}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {signedIn && isMember && (
              <button
                type="button"
                disabled={checkInBusy || checkInQ.data?.destinationLat == null}
                onClick={() => handleCheckIn(false)}
                className="inline-flex items-center gap-2 rounded-md border-2 border-ink bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-paper disabled:opacity-50"
              >
                {checkInBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MapPin className="h-4 w-4" />
                )}
                {lang === "af" ? "Lid — teken in" : "Member — check in"}
              </button>
            )}
            <button
              type="button"
              disabled={checkInBusy || checkInQ.data?.destinationLat == null || !signedIn}
              onClick={() => handleCheckIn(true)}
              className="inline-flex items-center gap-2 rounded-md border-2 border-ink bg-paper px-4 py-2 text-sm font-bold uppercase tracking-wider text-ink disabled:opacity-50"
            >
              {checkInBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <User className="h-4 w-4" />
              )}
              {lang === "af" ? "Ek is ’n toeskouer" : "I am a spectator"}
            </button>
          </div>
          {!signedIn && (
            <p className="mt-2 text-xs text-ink/60">
              {lang === "af"
                ? "Teken eers in as gas of lid om die toeskouer-knoppie te gebruik."
                : "Sign in first (guest or member) to use the spectator button."}
            </p>
          )}
          {checkInErr && <p className="mt-2 text-sm font-bold text-primary">{checkInErr}</p>}
        </div>
      )}

      {checkedIn && (
        <p className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-green-700">
          <Check className="h-3.5 w-3.5" />
          {isSpectator
            ? lang === "af"
              ? "Toeskouer — ingeteken"
              : "Spectator — checked in"
            : lang === "af"
              ? "Lid — ingeteken op die terrein"
              : "Member — checked in on site"}
          {checkInQ.data?.distanceM != null
            ? ` · ${checkInQ.data.distanceM} m`
            : ""}
        </p>
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
                if (signedIn && !checkedIn) {
                  setCheckInErr(
                    lang === "af"
                      ? "Teken eers in op die terrein om te stem."
                      : "Check in on site first to score.",
                  );
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

            {/* Tag controls */}
            {isMember && (
              <div className="mt-2 border-t border-ink/10 pt-2">
                {taggingId === v.id ? (
                  <div className="space-y-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => claimAsMe(v.id)}
                      className="inline-flex items-center gap-1 rounded border-2 border-ink bg-primary px-2 py-1 text-xs font-bold uppercase text-paper"
                    >
                      <User className="h-3 w-3" />
                      {lang === "af" ? "Dis myne" : "This is mine"}
                    </button>
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
