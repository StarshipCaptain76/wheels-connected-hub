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
import { listIdleLeaderboard, submitIdleTest } from "@/lib/idle-test.functions";
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

  const [identityReady, setIdentityReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [yearInput, setYearInput] = useState("");
  const [live, setLive] = useState<CaptureLiveState | null>(null);
  const sessionRef = useRef<CaptureSession | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      if (!session?.user) {
        setIdentityReady(true);
        return;
      }
      setMyUserId(session.user.id);
      const { data: admin } = await supabase.rpc("has_role", {
        _user_id: session.user.id,
        _role: "admin",
      });
      setIsAdmin(!!admin);
      setIdentityReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!s) {
        setIsAdmin(false);
        setMyUserId(null);
        setIdentityReady(true);
      }
    });
    return () => {
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
  const enabled = !!concoursQ.data?.idle_test_enabled;
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
    if (!canRun || busy) return;
    if (officialIds.has(v.id) && !isAdmin) {
      setMsg(
        af ? "Hierdie kar het al ’n amptelike lopie." : "This car already has an official run.",
      );
      return;
    }
    setSelectedId(v.id);
    const year =
      v.vehicle_year ??
      garageQ.data?.find((x) => x.id === v.garage_vehicle_id)?.year ??
      (Number.isInteger(Number(yearInput)) ? Number(yearInput) : null);
    if (year == null) {
      setMsg(af ? "Jaar van die kar word vereis." : "Vehicle year is required.");
      return;
    }
    if (!hasMotionSupport()) {
      setMsg(
        af ? "Hierdie toestel het geen bewegingsensor nie." : "This device has no motion sensor.",
      );
      return;
    }
    setMsg(null);
    const permitted = await requestMotionPermission();
    if (!permitted) {
      setMsg(af ? "Bewegingstoestemming geweier." : "Motion permission denied.");
      return;
    }
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
      setBusy(true);
      try {
        await submit({
          data: {
            eventId,
            vehicleId: v.id,
            metrics: result.metrics,
            samples: result.samples,
            year,
          },
        });
        setMsg(af ? "Amptelike lopie gestuur. Wag vir die ranglys." : "Official run submitted.");
        await qc.invalidateQueries({ queryKey: ["idle-tests", eventId] });
        await qc.invalidateQueries({ queryKey: ["concours", eventId] });
      } catch (err) {
        setMsg(err instanceof Error ? err.message : "Submit failed");
      } finally {
        setBusy(false);
      }
    });
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
                className="flex items-center justify-between rounded border-2 border-ink bg-paper px-3 py-2 text-sm"
              >
                <span>
                  {revealed && <span className="mr-2 font-bold text-primary">#{i + 1}</span>}
                  {r.tagged_display_name || r.vehicle_label || (af ? "Voertuig" : "Vehicle")}
                  {r.vehicle_year != null ? ` · ${r.vehicle_year}` : ""}
                </span>
                <span className="font-bold tabular-nums">
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
              ? "Sit die foon plat op die kar op die dag — ons meet hoe sag die aansit en luier is, soos ’n Rolls-Royce."
              : "On the day, lay your phone flat on the car — we measure how gentle the start and idle are, Rolls-Royce style."}
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
          ? "Net die eienaar (of ’n admin) mag ’n amptelike lopie doen. Een geldige lopie per kar. Toeskouers sien die ranglys wanneer dit oopgemaak word."
          : "Only the tagged owner (or an admin) may record an official run. One valid run per car. Spectators see the board once it’s revealed."}
      </p>

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
            return (
              <li key={v.id} className="rounded-lg border-2 border-ink bg-paper p-3">
                <p className="font-bold text-ink">
                  {v.tagged_display_name || v.label || (af ? "Voertuig" : "Vehicle")}
                  {v.vehicle_year != null ? ` · ${v.vehicle_year}` : ""}
                </p>
                {done && (
                  <p className="text-xs text-ink/60">
                    {af ? "Amptelike lopie is in." : "Official run is in."}
                  </p>
                )}
                {!done && v.vehicle_year == null && (
                  <label className="mt-2 block text-xs font-bold uppercase tracking-wider text-ink/70">
                    {af ? "Jaar" : "Year"}
                    <input
                      inputMode="numeric"
                      value={yearInput}
                      onChange={(e) => {
                        setSelectedId(v.id);
                        setYearInput(e.target.value);
                      }}
                      placeholder="e.g. 1968"
                      className="mt-1 w-full rounded-md border-2 border-ink bg-paper px-3 py-2 text-sm font-bold"
                    />
                  </label>
                )}
                <button
                  type="button"
                  disabled={busy || (!isAdmin && done) || (active && capturing)}
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
                      ? "Begin toets"
                      : "Start test"}
                </button>
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
