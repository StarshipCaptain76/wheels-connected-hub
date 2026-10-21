import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getEventConcours,
  listConcoursVehicles,
  listMyGaragePicks,
  getMyEventCheckIn,
  checkInToEvent,
  type ConcoursVehicle,
} from "@/lib/concours.functions";
import { isConcoursWindowOpen, concoursPhase } from "@/lib/concours-window";
import { listIdleLeaderboard, submitIdleTest, saveIdleVehicleSetup } from "@/lib/idle-test.functions";
import {
  hasMotionSupport,
  requestMotionPermission,
  startCapture,
  type CaptureLiveState,
  type CaptureSession,
} from "@/lib/idle-test-sensors";
import { IdleTestMeter } from "@/components/IdleTestMeter";
import { useI18n } from "@/i18n/I18nProvider";
import { supabase } from "@/integrations/supabase/client";
import { Gauge, Loader2 } from "lucide-react";
import { canSeeIdleCompetition } from "@/lib/concours-questions";
import { Button } from "@/components/ui/button";
import { parseIdleVehicleYear, updateIdleVehicleDraft, type IdleVehicleDraft } from "@/lib/idle-vehicle-setup";
import { concoursImageUrl } from "@/lib/event-image-url";

type Props = {
  eventId: string;
  eventStartsAt: string;
  eventEndsAt?: string | null;
};

function gpsError(err: unknown, af: boolean): string {
  if (err instanceof Error && err.message === "GPS_UNSUPPORTED") {
    return af ? "Jou toestel ondersteun nie GPS nie." : "Your device does not support GPS.";
  }
  if (err && typeof err === "object" && "code" in err) {
    return af
      ? "GPS toegang geweier — skakel liggingdienste aan."
      : "Location denied — turn on location services.";
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

export function IdleTestChallenge({ eventId, eventStartsAt, eventEndsAt }: Props) {
  const { lang } = useI18n();
  const af = lang === "af";
  const qc = useQueryClient();
  const doCheckIn = useServerFn(checkInToEvent);
  const submit = useServerFn(submitIdleTest);
  const saveSetup = useServerFn(saveIdleVehicleSetup);

  const [identityReady, setIdentityReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, IdleVehicleDraft>>({});
  const [pendingCapture, setPendingCapture] = useState<{ vehicleId: string; year: number; result: Extract<import("@/lib/idle-test-sensors").CaptureResult, { ok: true }> } | null>(null);
  const startingRef = useRef(false);
  const [live, setLive] = useState<CaptureLiveState | null>(null);
  const sessionRef = useRef<CaptureSession | null>(null);

  useEffect(() => {
    let active = true;
    let revision = 0;
    async function refreshIdentity(userId: string | null) {
      const current = ++revision;
      setIdentityReady(false);
      if (!userId) {
        setIsAdmin(false);
        setIsMember(false);
        setMyUserId(null);
        setIdentityReady(true);
        return;
      }
      const [{ data: profile }, { data: admin }] = await Promise.all([
        supabase.from("profiles").select("membership_status").eq("id", userId).maybeSingle(),
        supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
      ]);
      if (!active || current !== revision) return;
      setMyUserId(userId);
      setIsMember(profile?.membership_status === "active" || profile?.membership_status === "member");
      setIsAdmin(!!admin);
      setIdentityReady(true);
    }
    supabase.auth.getSession().then(({ data }) => {
      if (active && revision === 0) void refreshIdentity(data.session?.user.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        // Run profile reads outside the auth callback's session lock.
        setTimeout(() => { if (active) void refreshIdentity(session?.user.id ?? null); }, 0);
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
      sessionRef.current?.stop();
    };
  }, []);

  const concoursQ = useQuery({
    queryKey: ["concours", eventId],
    queryFn: () => getEventConcours({ data: { eventId } }),
  });

  const windowOpen = isConcoursWindowOpen(eventStartsAt, eventEndsAt);
  const phase = concoursPhase(eventStartsAt, eventEndsAt);
  const enabled = identityReady && canSeeIdleCompetition(isMember, isAdmin) && !!concoursQ.data?.idle_test_enabled;
  const revealed = !!concoursQ.data?.idle_test_revealed;

  const vehiclesQ = useQuery({
    queryKey: ["concours-vehicles", eventId],
    enabled,
    queryFn: () => listConcoursVehicles({ data: { eventId } }),
  });

  const checkInQ = useQuery({
    queryKey: ["event-checkin", eventId, myUserId],
    enabled: enabled && !!myUserId,
    queryFn: () => getMyEventCheckIn({ data: { eventId } }),
  });

  const garageQ = useQuery({
    queryKey: ["garage-picks", "me"],
    enabled: enabled && !!myUserId,
    queryFn: () => listMyGaragePicks(),
  });

  const boardQ = useQuery({
    queryKey: ["idle-tests", eventId, myUserId, revealed],
    enabled,
    queryFn: () => listIdleLeaderboard({ data: { eventId } }),
    refetchInterval: revealed ? 15_000 : false,
  });

  const myCars = useMemo(
    () =>
      (vehiclesQ.data ?? []).filter(
        (v) => isAdmin || (!!myUserId && v.tagged_user_id === myUserId),
      ),
    [vehiclesQ.data, isAdmin, myUserId],
  );
  const officialIds = useMemo(
    () => new Set((boardQ.data ?? []).map((r) => r.vehicle_id)),
    [boardQ.data],
  );

  const capturing = !!live && live.phase !== "done" && live.phase !== "rejected";

  const checkedIn = !!checkInQ.data?.checkedIn && !checkInQ.data.isSpectator;
  const canRun = (checkedIn || isAdmin) && windowOpen && !!myUserId;

  if (concoursQ.isLoading) return null;
  if (!enabled) return null;

  const c = concoursQ.data;
  const prize = af && c?.idle_prize_af ? c.idle_prize_af : c?.idle_prize_en;

  async function handleCheckIn() {
    setBusy(true);
    setMsg(null);
    try {
      let pos: { lat: number; lng: number } | null = null;
      try {
        pos = await readGps();
      } catch (err) {
        if (!isAdmin) throw err;
      }
      await doCheckIn({
        data: { eventId, lat: pos?.lat ?? 0, lng: pos?.lng ?? 0 },
      });
      await qc.invalidateQueries({ queryKey: ["event-checkin", eventId] });
    } catch (err) {
      setMsg(gpsError(err, af));
    } finally {
      setBusy(false);
    }
  }

  async function beginCapture(v: ConcoursVehicle) {
    if (!canRun || busy || capturing || startingRef.current || pendingCapture) return;
    if (officialIds.has(v.id) && !isAdmin) {
      setMsg(
        af ? "Hierdie kar het al ’n amptelike lopie." : "This car already has an official run.",
      );
      return;
    }
    setSelectedId(v.id);
    const draft = vehicleDraft(v);
    const year = parseIdleVehicleYear(draft.year);
    if (year == null) {
      setMsg(af ? "Jaar van die kar word vereis." : "Vehicle year is required.");
      return;
    }
    if (!draft.make.trim() || !draft.model.trim()) {
      setMsg(af ? "Vul die fabrikaat en model in." : "Enter the vehicle make and model.");
      return;
    }
    if (!hasMotionSupport()) {
      setMsg(
        af ? "Hierdie toestel het geen bewegingsensor nie." : "This device has no motion sensor.",
      );
      return;
    }
    setMsg(null);
    startingRef.current = true;
    const permitted = await requestMotionPermission();
    if (!permitted) {
      startingRef.current = false;
      setMsg(af ? "Bewegingstoestemming geweier." : "Motion permission denied.");
      return;
    }
    setBusy(true);
    try {
      await saveSetup({ data: { eventId, vehicleId: v.id, year, make: draft.make.trim(), model: draft.model.trim(), powertrain: draft.powertrain as "ice" | "diesel" | "hybrid" | "ev" | "other" } });
      await qc.invalidateQueries({ queryKey: ["concours-vehicles", eventId] });
      await qc.invalidateQueries({ queryKey: ["concours-vehicles-admin", eventId] });
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Vehicle details could not be saved");
      startingRef.current = false;
      setBusy(false);
      return;
    }
    setBusy(false);
    startingRef.current = false;
    sessionRef.current?.stop();
    setLive({
      phase: "wait_flat",
      tiltDeg: 0,
      isFlat: false,
      mag: 0,
      threshold: 0.12,
      progress01: 0,
      countdownSec: null,
      rejectReason: null,
    });
    sessionRef.current = startCapture(async (state, result) => {
      setLive(state);
      if (!result) return;
      sessionRef.current?.stop();
      sessionRef.current = null;
      if (!result.ok) return;
      const capture = { vehicleId: v.id, year, result };
      setPendingCapture(capture);
      await sendCapture(capture);
    });
  }

  function vehicleDraft(v: ConcoursVehicle): IdleVehicleDraft {
    const garage = garageQ.data?.find((g) => g.id === v.garage_vehicle_id);
    return drafts[v.id] ?? { year: String(v.vehicle_year ?? garage?.year ?? ""), make: v.vehicle_make ?? garage?.make ?? "", model: v.vehicle_model ?? garage?.model ?? "", powertrain: v.powertrain ?? "ice" };
  }

  async function sendCapture(capture: NonNullable<typeof pendingCapture>) {
    setBusy(true);
    try {
      await submit({ data: { eventId, vehicleId: capture.vehicleId, metrics: capture.result.metrics, samples: capture.result.samples, year: capture.year } });
      setPendingCapture(null);
      setMsg(af ? "Amptelike lopie gestuur." : "Official run submitted.");
      await qc.invalidateQueries({ queryKey: ["idle-tests", eventId] });
      await qc.invalidateQueries({ queryKey: ["concours", eventId] });
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Submit failed — retry saving this capture");
    } finally { setBusy(false); }
  }

  const board =
    revealed || (boardQ.data ?? []).length > 0 ? (
      <div className="mt-5">
        <h3 className="font-display text-xl text-ink">
          {af ? "Luier-ranglys" : "Idle leaderboard"}
        </h3>
        {!revealed && (
          <p className="mt-1 text-xs text-ink/60">
            {af
              ? "Net jy sien jou lopie totdat die ranglys oopgemaak word."
              : "Only you see your run until the leaderboard is revealed."}
          </p>
        )}
        {(boardQ.data ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-ink/50">
            {af ? "Nog geen amptelike lopies nie." : "No official runs yet."}
          </p>
        ) : revealed || myUserId ? (
          <ol className="mt-2 space-y-1">
            {(revealed
              ? (boardQ.data ?? [])
              : (boardQ.data ?? []).filter((r) => r.user_id === myUserId)
            ).map((r, i) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded border-2 border-ink bg-paper px-3 py-2 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <img
                    src={concoursImageUrl(r.vehicle_id)}
                    alt=""
                    loading="lazy"
                    className="h-10 w-14 shrink-0 rounded border border-ink object-cover"
                  />
                  <span className="min-w-0">
                    {revealed && <span className="mr-2 font-bold text-primary">#{i + 1}</span>}
                    <span className="font-bold text-ink">
                      {r.tagged_display_name || r.vehicle_label || (af ? "Voertuig" : "Vehicle")}
                    </span>
                    <span className="block truncate text-xs text-ink/60">
                      {[r.vehicle_make, r.vehicle_model].filter(Boolean).join(" ") ||
                        (af ? "Onbekende kar" : "Unknown car")}
                      {r.vehicle_year != null ? ` · ${r.vehicle_year}` : ""}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 font-bold tabular-nums">
                  {r.display_score != null ? r.display_score.toFixed(1) : "—"}
                </span>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    ) : null;

  if (!windowOpen) {
    return (
      <section className="mt-8 rounded-lg border-2 border-primary/50 bg-primary/5 p-5">
        <h2 className="flex items-center gap-2 font-display text-2xl text-ink">
          <Gauge className="h-6 w-6 text-primary" />
          {af ? "Rolls-Royce Begin & Luier" : "Rolls-Royce Start & Idle"}
        </h2>
        <p className="mt-2 text-sm text-ink/80">
          {phase === "after"
            ? af
              ? "Die luier-toets is toe. Dankie dat jy deelgeneem het."
              : "The idle test is closed. Thanks for taking part."
            : af
              ? "Lê die foon op ’n dun lap/seem op die enjinkap voordat jy aansit. Ons meet die aansit en 30 sekondes se luier."
              : "Place the phone on a thin cloth/chamois on the bonnet before starting. We measure the start and 30 seconds of idling."}
        </p>
        {prize && <p className="mt-2 text-sm font-bold text-primary">{prize}</p>}
        {(revealed || phase === "after") && board}
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-lg border-2 border-ink bg-card p-5">
      <h2 className="flex items-center gap-2 font-display text-2xl text-ink">
        <Gauge className="h-6 w-6 text-primary" />
        {af ? "Rolls-Royce Begin & Luier" : "Rolls-Royce Start & Idle"}
      </h2>
      {prize && <p className="mt-1 text-sm font-bold text-primary">{prize}</p>}
      <p className="mt-2 text-sm text-ink/70">
        {af
          ? "Net die lid-eienaar (of ’n admin) mag ’n amptelike lopie doen. Een geldige lopie per kar."
          : "Only the member who owns the car (or an admin) may record an official run. One valid run per car."}
      </p>

      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-ink/80">
        <li>{af ? "Parkeer buite, handrem aan, in parkeer/neutraal; enjin af." : "Park outdoors, parking brake on, in park/neutral; engine off."}</li>
        <li>{af ? "Lê die foon plat op ’n dun, nie-glyende lap/seem op ’n koel, geslote enjinkap. Moenie dik opvou of naby ’n rand plaas nie." : "Place the phone flat on a thin, non-slip cloth/chamois on a cool, closed bonnet. Do not fold it thickly or place near an edge."}</li>
        <li>{af ? "Hou hierdie skerm oop. Wag vir die aansitboodskap, begin dan die enjin sonder om te versnel." : "Keep this screen open. Wait for the start prompt, then start the engine without revving."}</li>
        <li>{af ? "Los die foon onaangeraak terwyl die enjin stabiliseer en vir die volle 30-sekonde luierlesing. As aansit gemis word, probeer die volle toets weer." : "Leave the phone untouched while the engine settles and for the full 30-second idle reading. If the start is missed, retry the full test."}</li>
      </ol>
      <p className="mt-2 text-xs text-ink/60">{af ? "Foon-gebaseerde skatting, nie ’n meganiese diagnose nie; gebruik dieselfde foon en plasing vir vergelykings." : "Phone-based estimate, not a mechanical diagnosis; use the same phone and placement for comparisons."}</p>
      {msg && <p className="mt-2 text-sm font-bold text-primary">{msg}</p>}

      {identityReady && !myUserId && (
        <p className="mt-3 text-sm text-ink/70">
          {af
            ? "Teken in om jou kar te toets. Toeskouers wag vir die ranglys."
            : "Sign in to test your car. Spectators wait for the leaderboard."}
        </p>
      )}

      {myUserId && !checkedIn && !isAdmin && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleCheckIn()}
          className="mt-4 inline-flex items-center justify-center rounded-md border-2 border-ink bg-primary px-4 py-3 text-sm font-bold uppercase tracking-wider text-paper disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {af ? "Teken in by die venue" : "Check in at the venue"}
        </button>
      )}

      {canRun && myCars.length === 0 && (
        <p className="mt-3 text-sm text-ink/60">
          {af
            ? "Merk eers jou kar by Concours Mini (Dis myne / koppel garage) voordat jy die luier-toets doen."
            : "Tag your car on Concours Mini (This is mine / link garage) before running the idle test."}
        </p>
      )}

      {canRun && myCars.length > 0 && (
        <ul className="mt-4 space-y-2">
          {myCars.map((v) => {
            const done = officialIds.has(v.id);
            const active = selectedId === v.id;
            const draft = vehicleDraft(v);
            const locked = busy || capturing || !!pendingCapture;
            return (
              <li key={v.id} className="rounded-lg border-2 border-ink bg-paper p-3">
                <img src={concoursImageUrl(v.id)} alt={v.label ?? "Vehicle"} className="mb-2 h-24 w-36 rounded object-cover" />
                <p className="font-bold text-ink">
                  {[v.vehicle_make, v.vehicle_model].filter(Boolean).join(" ") || v.label || "Vehicle"} ·
                  {v.tagged_display_name || v.label || (af ? "Voertuig" : "Vehicle")}
                  {v.vehicle_year != null ? ` · ${v.vehicle_year}` : ""}
                </p>
                {done && (
                  <p className="text-xs text-ink/60">
                    {af ? "Amptelike lopie is in." : "Official run is in."}
                  </p>
                )}
                {(!done || isAdmin) && <fieldset disabled={locked} className="mt-3 grid gap-3 sm:grid-cols-4">
                  {([['year', af ? 'Jaar' : 'Year'], ['make', af ? 'Fabrikaat' : 'Make'], ['model', 'Model']] as const).map(([key, label]) => <label key={key} className="text-xs font-bold text-ink">{label}<input aria-label={`${label} ${v.id}`} inputMode={key === 'year' ? 'numeric' : 'text'} value={draft[key]} onChange={(e) => setDrafts((d) => updateIdleVehicleDraft(d, v.id, { ...draft, [key]: e.target.value }))} className="mt-1 w-full rounded-md border-2 border-ink bg-paper px-3 py-2 text-sm" /></label>)}
                  <label className="text-xs font-bold text-ink">{af ? 'Aandrywing' : 'Powertrain'}<select value={draft.powertrain} onChange={(e) => setDrafts((d) => updateIdleVehicleDraft(d, v.id, { ...draft, powertrain: e.target.value }))} className="mt-1 w-full rounded-md border-2 border-ink bg-paper px-3 py-2 text-sm"><option value="ice">Petrol</option><option value="diesel">Diesel</option><option value="hybrid">Hybrid</option><option value="ev">EV</option><option value="other">Other</option></select></label>
                </fieldset>}
                <Button
                  type="button"
                  disabled={locked || (!isAdmin && done)}
                  onClick={() => void beginCapture(v)}
                  className="mt-2 inline-flex items-center gap-2 rounded-md border-2 border-ink bg-primary px-3 py-2 text-xs font-bold uppercase tracking-wider text-paper disabled:opacity-50"
                >
                  {busy && active ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Gauge className="h-3.5 w-3.5" />
                  )}
                  {done && isAdmin
                    ? af
                      ? "Nuwe lopie (admin)"
                      : "New run (admin)"
                    : af
                      ? "Stoor en begin toets"
                      : "Save & start test"}
                </Button>
                {active && capturing && <Button variant="outline" size="sm" className="ml-2" onClick={() => { sessionRef.current?.stop(); sessionRef.current = null; setLive(null); }}>{af ? 'Kanselleer' : 'Cancel'}</Button>}
                {active && pendingCapture && !busy && <Button variant="outline" className="ml-2" onClick={() => void sendCapture(pendingCapture)}>{af ? 'Probeer stoor weer' : 'Retry saving capture'}</Button>}
                {active && live && <IdleTestMeter live={live} lang={lang} />}
              </li>
            );
          })}
        </ul>
      )}

      {board}
    </section>
  );
}
