import type { IdleMetrics } from "@/lib/idle-test-score";

/** Capture protocol timings (ms) and thresholds. */
export const FLAT_HOLD_MS = 400;
export const BASELINE_MS = 2000;
export const BASELINE_MAX_RMS = 0.045;
export const HP_WINDOW_MS = 400;
export const ARM_TIMEOUT_MS = 18_000;
export const SPIKE_HOLD_MS = 80;
export const SPIKE_MIN_MAG = 0.12;
export const IDLE_MS = 12_000;
export const TILT_FLAT_MAX_DEG = 15;
export const TILT_JUMP_DEG = 25;
export const SAMPLE_HZ = 5;
export const SPIKE_MAX_MS = 2000;
export const MOTION_WATCHDOG_MS = 2500;

export type CapturePhase =
  "wait_flat" | "baseline" | "armed" | "start" | "idle" | "done" | "rejected";

export type CaptureRejectReason =
  "picked_up" | "noisy_baseline" | "no_motion" | "permission_denied" | "not_supported";

export type CaptureLiveState = {
  phase: CapturePhase;
  tiltDeg: number;
  isFlat: boolean;
  mag: number;
  threshold: number;
  progress01: number;
  countdownSec: number | null;
  rejectReason: CaptureRejectReason | null;
};

export type CaptureOk = {
  ok: true;
  metrics: IdleMetrics;
  samples: number[];
};

export type CaptureFail = {
  ok: false;
  reason: CaptureRejectReason;
};

export type CaptureResult = CaptureOk | CaptureFail;

export type CaptureSession = {
  stop: () => void;
};

type AccSample = { t: number; x: number; y: number; z: number };

function rmsOf(values: number[]): number {
  if (values.length === 0) return 0;
  let s = 0;
  for (const v of values) s += v * v;
  return Math.sqrt(s / values.length);
}

function stdevOf(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  let s = 0;
  for (const v of values) s += (v - mean) ** 2;
  return Math.sqrt(s / values.length);
}

export function tiltDegFromGravity(gx: number, gy: number, gz: number): number {
  const mag = Math.hypot(gx, gy, gz);
  if (mag < 1e-6) return 90;
  const z = Math.min(1, Math.abs(gz) / mag);
  return (Math.acos(z) * 180) / Math.PI;
}

export function downsampleMag(points: Array<{ t: number; mag: number }>, hz = SAMPLE_HZ): number[] {
  if (points.length === 0) return [];
  const step = 1000 / hz;
  const out: number[] = [];
  let nextT = points[0].t;
  let last = points[0].mag;
  for (const p of points) {
    last = p.mag;
    while (p.t + 1e-6 >= nextT) {
      out.push(last);
      nextT += step;
    }
  }
  if (out.length === 0) out.push(last);
  return out;
}

/** Pure capture state machine. Feed DeviceMotion samples via `push`. */
export class IdleCaptureEngine {
  phase: CapturePhase = "wait_flat";
  rejectReason: CaptureRejectReason | null = null;
  private hp: AccSample[] = [];
  private flatSince: number | null = null;
  private lockedTilt: number | null = null;
  private baselineStart: number | null = null;
  private baselineMags: number[] = [];
  private baselineRms = 0;
  private threshold = SPIKE_MIN_MAG;
  private armStart: number | null = null;
  private spikeOnSince: number | null = null;
  private startOnSince: number | null = null;
  private startPeak = 0;
  private durationMs = 0;
  private startDetected = false;
  private idleStart: number | null = null;
  private idleMags: number[] = [];
  private magTrace: Array<{ t: number; mag: number }> = [];
  private lastTilt = 0;
  private lastMag = 0;
  private result: CaptureResult | null = null;

  push(t: number, x: number, y: number, z: number): CaptureLiveState {
    if (this.phase === "done" || this.phase === "rejected") return this.live();

    this.hp.push({ t, x, y, z });
    const cut = t - HP_WINDOW_MS;
    while (this.hp.length > 1 && this.hp[0].t < cut) this.hp.shift();
    let sx = 0,
      sy = 0,
      sz = 0;
    for (const s of this.hp) {
      sx += s.x;
      sy += s.y;
      sz += s.z;
    }
    const n = this.hp.length || 1;
    const rx = x - sx / n;
    const ry = y - sy / n;
    const rz = z - sz / n;
    const mag = Math.hypot(rx, ry, rz);
    const tilt = tiltDegFromGravity(x, y, z);
    const isFlat = tilt <= TILT_FLAT_MAX_DEG;
    this.lastTilt = tilt;
    this.lastMag = mag;
    this.magTrace.push({ t, mag });

    if (this.lockedTilt != null && Math.abs(tilt - this.lockedTilt) > TILT_JUMP_DEG) {
      return this.reject("picked_up");
    }

    switch (this.phase) {
      case "wait_flat": {
        if (isFlat) {
          if (this.flatSince == null) this.flatSince = t;
          if (t - this.flatSince >= FLAT_HOLD_MS) {
            this.phase = "baseline";
            this.baselineStart = t;
            this.baselineMags = [];
            this.lockedTilt = tilt;
          }
        } else {
          this.flatSince = null;
        }
        break;
      }
      case "baseline": {
        this.baselineMags.push(mag);
        if (this.baselineStart != null && t - this.baselineStart >= BASELINE_MS) {
          const rms = rmsOf(this.baselineMags);
          if (rms > BASELINE_MAX_RMS) return this.reject("noisy_baseline");
          this.baselineRms = rms;
          this.threshold = Math.max(SPIKE_MIN_MAG, rms * 3);
          this.phase = "armed";
          this.armStart = t;
          this.spikeOnSince = null;
        }
        break;
      }
      case "armed": {
        if (mag > this.threshold) {
          if (this.spikeOnSince == null) this.spikeOnSince = t;
          if (t - this.spikeOnSince >= SPIKE_HOLD_MS) {
            this.phase = "start";
            this.startDetected = true;
            this.startOnSince = this.spikeOnSince;
            this.startPeak = mag;
          }
        } else {
          this.spikeOnSince = null;
        }
        if (this.armStart != null && t - this.armStart >= ARM_TIMEOUT_MS) {
          this.startDetected = false;
          this.startPeak = 0;
          this.durationMs = 0;
          this.beginIdle(t);
        }
        break;
      }
      case "start": {
        this.startPeak = Math.max(this.startPeak, mag);
        const started = this.startOnSince ?? t;
        if (mag <= this.threshold) {
          this.durationMs = t - started;
          this.beginIdle(t);
        } else if (t - started >= SPIKE_MAX_MS) {
          this.durationMs = SPIKE_MAX_MS;
          this.beginIdle(t);
        }
        break;
      }
      case "idle": {
        this.idleMags.push(mag);
        if (this.idleStart != null && t - this.idleStart >= IDLE_MS) {
          this.finishOk();
        }
        break;
      }
      default:
        break;
    }
    return this.live();
  }

  fail(reason: CaptureRejectReason): CaptureLiveState {
    return this.reject(reason);
  }

  getResult(): CaptureResult | null {
    return this.result;
  }

  private beginIdle(t: number) {
    this.phase = "idle";
    this.idleStart = t;
    this.idleMags = [];
  }

  private finishOk() {
    const idle = this.idleMags;
    const rms = rmsOf(idle);
    let min = Infinity;
    let max = -Infinity;
    for (const v of idle) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const p2p = idle.length ? max - min : 0;
    const mean = idle.length ? idle.reduce((a, b) => a + b, 0) / idle.length : 0;
    const cv = mean > 1e-9 ? stdevOf(idle) / mean : 0;
    this.phase = "done";
    this.result = {
      ok: true,
      metrics: {
        startDetected: this.startDetected,
        startPeak: this.startPeak,
        durationMs: this.durationMs,
        rms,
        p2p,
        cv,
      },
      samples: downsampleMag(this.magTrace),
    };
  }

  private reject(reason: CaptureRejectReason): CaptureLiveState {
    this.phase = "rejected";
    this.rejectReason = reason;
    this.result = { ok: false, reason };
    return this.live();
  }

  private live(): CaptureLiveState {
    let progress01 = 0;
    let countdownSec: number | null = null;
    const now = this.magTrace.length ? this.magTrace[this.magTrace.length - 1].t : 0;
    if (this.phase === "wait_flat" && this.flatSince != null) {
      progress01 = Math.min(1, (now - this.flatSince) / FLAT_HOLD_MS);
    } else if (this.phase === "baseline" && this.baselineStart != null) {
      const elapsed = now - this.baselineStart;
      progress01 = Math.min(1, elapsed / BASELINE_MS);
      countdownSec = Math.max(0, (BASELINE_MS - elapsed) / 1000);
    } else if (this.phase === "armed" && this.armStart != null) {
      const elapsed = now - this.armStart;
      progress01 = Math.min(1, elapsed / ARM_TIMEOUT_MS);
      countdownSec = Math.max(0, (ARM_TIMEOUT_MS - elapsed) / 1000);
    } else if (this.phase === "start" && this.startOnSince != null) {
      progress01 = Math.min(1, (now - this.startOnSince) / SPIKE_MAX_MS);
    } else if (this.phase === "idle" && this.idleStart != null) {
      const elapsed = now - this.idleStart;
      progress01 = Math.min(1, elapsed / IDLE_MS);
      countdownSec = Math.max(0, (IDLE_MS - elapsed) / 1000);
    } else if (this.phase === "done") {
      progress01 = 1;
    }
    return {
      phase: this.phase,
      tiltDeg: this.lastTilt,
      isFlat: this.lastTilt <= TILT_FLAT_MAX_DEG,
      mag: this.lastMag,
      threshold: this.threshold,
      progress01,
      countdownSec,
      rejectReason: this.rejectReason,
    };
  }
}

export function hasMotionSupport(): boolean {
  return typeof window !== "undefined" && typeof DeviceMotionEvent !== "undefined";
}

export async function requestMotionPermission(): Promise<boolean> {
  if (!hasMotionSupport()) return false;
  const DME = DeviceMotionEvent as unknown as {
    requestPermission?: () => Promise<string>;
  };
  if (typeof DME.requestPermission === "function") {
    try {
      const res = await DME.requestPermission();
      return res === "granted";
    } catch {
      return false;
    }
  }
  return true;
}

export function startCapture(
  onLive: (state: CaptureLiveState, result: CaptureResult | null) => void,
): CaptureSession {
  const engine = new IdleCaptureEngine();
  let stopped = false;
  let sawSample = false;

  const onMotion = (ev: DeviceMotionEvent) => {
    if (stopped) return;
    const acc = ev.accelerationIncludingGravity ?? ev.acceleration;
    if (!acc || acc.x == null || acc.y == null || acc.z == null) return;
    sawSample = true;
    const t = typeof performance !== "undefined" ? performance.now() : Date.now();
    const live = engine.push(t, acc.x, acc.y, acc.z);
    const result = live.phase === "done" || live.phase === "rejected" ? engine.getResult() : null;
    onLive(live, result);
    if (live.phase === "done" || live.phase === "rejected") stop();
  };

  const watchdog = window.setTimeout(() => {
    if (stopped || sawSample) return;
    const live = engine.fail("no_motion");
    onLive(live, engine.getResult());
    stop();
  }, MOTION_WATCHDOG_MS);

  function stop() {
    if (stopped) return;
    stopped = true;
    window.clearTimeout(watchdog);
    window.removeEventListener("devicemotion", onMotion);
  }

  window.addEventListener("devicemotion", onMotion);
  return { stop };
}
