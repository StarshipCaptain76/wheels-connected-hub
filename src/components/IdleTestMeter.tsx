import type { CaptureLiveState } from "@/lib/idle-test-sensors";

type Props = {
  live: CaptureLiveState;
  lang: "en" | "af";
};

const PHASE_EN: Record<CaptureLiveState["phase"], string> = {
  wait_flat: "Lay the phone flat on a firm surface",
  baseline: "Hold still — measuring quiet baseline",
  armed: "Start the engine when ready",
  start: "Start detected…",
  idle: "Idling — don’t touch the phone",
  done: "Capture complete",
  rejected: "Capture rejected",
};

const PHASE_AF: Record<CaptureLiveState["phase"], string> = {
  wait_flat: "Lê die foon plat op ’n stewige oppervlak",
  baseline: "Hou stil — meet stil basislyn",
  armed: "Begin die enjin wanneer jy gereed is",
  start: "Aansit bespeur…",
  idle: "Luier — moenie die foon aanraak nie",
  done: "Opname klaar",
  rejected: "Opname afgekeur",
};

const REJECT_EN: Record<NonNullable<CaptureLiveState["rejectReason"]>, string> = {
  picked_up: "Phone was picked up or tilted. Keep it flat.",
  noisy_baseline: "Too much movement before start. Engine off, phone still.",
  no_motion: "No motion sensor data. Try Chrome or Safari, not in-app browsers.",
  permission_denied: "Motion permission denied.",
  not_supported: "This device has no motion sensor.",
};

const REJECT_AF: Record<NonNullable<CaptureLiveState["rejectReason"]>, string> = {
  picked_up: "Foon is opgetel of gekantel. Hou dit plat.",
  noisy_baseline: "Te veel beweging voor aansit. Enjin af, foon stil.",
  no_motion: "Geen bewegingsensor. Probeer Chrome of Safari.",
  permission_denied: "Bewegingstoestemming geweier.",
  not_supported: "Hierdie toestel het geen bewegingsensor nie.",
};

export function IdleTestMeter({ live, lang }: Props) {
  const phaseCopy = lang === "af" ? PHASE_AF : PHASE_EN;
  const rejectCopy = lang === "af" ? REJECT_AF : REJECT_EN;
  const bar = Math.min(1, live.mag / Math.max(live.threshold, 0.12) / 2);
  const countdown = live.countdownSec == null ? null : Math.ceil(live.countdownSec);

  return (
    <div className="mt-4 space-y-3 rounded-lg border-2 border-ink bg-paper p-3">
      <div className="flex items-center justify-between gap-2">
        <span
          className={`rounded-full border-2 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
            live.isFlat ? "border-ink bg-primary text-paper" : "border-ink bg-paper text-primary"
          }`}
        >
          {live.isFlat ? "FLAT" : "TILT"}
        </span>
        <span className="text-xs font-bold text-ink/70">
          {lang === "af" ? "Kantel" : "Tilt"} {live.tiltDeg.toFixed(0)}°
        </span>
      </div>

      <div className="h-3 w-full overflow-hidden rounded-full border-2 border-ink bg-ink/10">
        <div
          className="h-full bg-primary transition-[width] duration-75"
          style={{ width: `${Math.round(bar * 100)}%` }}
        />
      </div>

      <p className="text-sm font-bold text-ink">{phaseCopy[live.phase]}</p>

      {countdown != null && live.phase !== "done" && live.phase !== "rejected" && (
        <p className="font-display text-3xl tabular-nums text-primary">{countdown}s</p>
      )}

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
        <div
          className="h-full bg-ink/40 transition-[width]"
          style={{ width: `${Math.round(live.progress01 * 100)}%` }}
        />
      </div>

      {live.rejectReason && (
        <p className="text-sm font-bold text-primary">{rejectCopy[live.rejectReason]}</p>
      )}
    </div>
  );
}
