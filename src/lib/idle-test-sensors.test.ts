import {
  IdleCaptureEngine,
  FLAT_HOLD_MS,
  BASELINE_MS,
  ARM_TIMEOUT_MS,
  IDLE_MS,
  IDLE_SETTLE_MS,
  BASELINE_SETTLE_TIMEOUT_MS,
  TILT_HOLD_MS,
  tiltDegFromGravity,
} from "./idle-test-sensors.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(Math.abs(tiltDegFromGravity(0, 0, 9.81)) < 1, "flat tilt ~0");
assert(tiltDegFromGravity(9.81, 0, 0) > 80, "on-edge tilt ~90");

function feed(
  engine: IdleCaptureEngine,
  t0: number,
  ms: number,
  xyz: (t: number) => [number, number, number],
  hz = 50,
) {
  const dt = 1000 / hz;
  let last = engine.phase;
  for (let t = t0; t <= t0 + ms; t += dt) {
    const [x, y, z] = xyz(t);
    last = engine.push(t, x, y, z).phase;
  }
  return last;
}

{
  const e = new IdleCaptureEngine();
  const phase = feed(e, 0, 800, () => [9.81, 0, 0]);
  assert(phase === "wait_flat", `tilted stays wait_flat, got ${phase}`);
}

{
  const e = new IdleCaptureEngine();
  feed(e, 0, FLAT_HOLD_MS + 50, () => [0, 0, 9.81]);
  assert(e.phase === "baseline", `flat 400ms enters baseline, got ${e.phase}`);
}

{
  const e = new IdleCaptureEngine();
  feed(e, 0, FLAT_HOLD_MS + 50, () => [0, 0, 9.81]);
  const noisy = feed(e, FLAT_HOLD_MS + 50, BASELINE_SETTLE_TIMEOUT_MS + BASELINE_MS + 50, (t) => [Math.sin(t / 8) * 3, 0, 9.81]);
  assert(noisy === "rejected", `noisy baseline rejected, got ${noisy}`);
  assert(e.getResult()?.ok === false, "noisy result fail");
}

{
  const e = new IdleCaptureEngine();
  let t = 0;
  feed(e, t, FLAT_HOLD_MS + 20, () => [0, 0, 9.81]);
  t += FLAT_HOLD_MS + 20;
  feed(e, t, BASELINE_MS + 20, () => [0, 0, 9.81]);
  t += BASELINE_MS + 20;
  assert(e.phase === "armed", `quiet baseline arms, got ${e.phase}`);
  feed(e, t, 120, () => [2.5, 0, 9.81]);
  t += 120;
  assert(e.phase === "start" || e.phase === "settling", `spike detected, got ${e.phase}`);
  feed(e, t, 2200, () => [0, 0, 9.81]);
  t += 2200;
  assert(e.phase === "settling", `then settling, got ${e.phase}`);
  feed(e, t, IDLE_SETTLE_MS + 40, () => [0, 0, 9.81]);
  t += IDLE_SETTLE_MS + 40;
  feed(e, t, IDLE_MS + 40, () => [0, 0, 9.81]);
  assert(e.phase === "done", `idle 30s completes, got ${e.phase}`);
  const res = e.getResult();
  assert(res && res.ok && res.metrics.startDetected, "startDetected");
  assert(res && res.ok && res.samples.length > 0, "downsampled samples");
  assert(res && res.ok && (res.metrics.idleDurationMs ?? 0) >= 30_000 && (res.metrics.idleSampleCount ?? 0) >= 300, "Full 30-second idle measured with enough samples");
}

{
  const e = new IdleCaptureEngine();
  let t = 0;
  feed(e, t, FLAT_HOLD_MS + 20, () => [0, 0, 9.81]);
  t += FLAT_HOLD_MS + 20;
  feed(e, t, BASELINE_MS + 20, () => [0, 0, 9.81]);
  t += BASELINE_MS + 20;
  const after = feed(e, t, ARM_TIMEOUT_MS + 40, () => [0, 0, 9.81]);
  assert(after === "rejected" && e.rejectReason === "start_not_detected", `missing start requires full retry, got ${after}`);
}

{
  const e = new IdleCaptureEngine();
  feed(e, 0, FLAT_HOLD_MS + 20, () => [0, 0, 9.81]);
  feed(e, FLAT_HOLD_MS + 40, TILT_HOLD_MS + 600, () => [9.81, 0, 0]);
  assert(e.phase === "rejected", "sustained tilt jump picked_up");
  assert(e.rejectReason === "picked_up", "picked_up reason");
}

{
  const e = new IdleCaptureEngine();
  feed(e, 0, FLAT_HOLD_MS + BASELINE_MS + 100, (t) => [Math.sin(t / 15) * 0.1, 0, 9.81]);
  assert(e.phase === 'armed', 'Normal small sensor noise must pass calibration');
  feed(e, FLAT_HOLD_MS + BASELINE_MS + 100, ARM_TIMEOUT_MS + IDLE_MS + 100, (t) => [Math.sin(t / 15) * 0.1, 0, 9.81]);
  assert(e.getResult()?.ok === false && e.rejectReason === 'start_not_detected', 'Quiet idle-only capture cannot be an official start-and-idle run');
}
{
  const e = new IdleCaptureEngine();
  feed(e, 0, FLAT_HOLD_MS + 20, () => [0, 0, 9.81]);
  feed(e, FLAT_HOLD_MS + 20, BASELINE_MS + 40, (t) => [Math.sin(t / 8) * 1, 0, 9.81]);
  assert(e.phase === 'baseline', 'First noisy calibration window retries rather than rejects');
  feed(e, FLAT_HOLD_MS + BASELINE_MS + 60, BASELINE_MS + 600, () => [0, 0, 9.81]);
  assert(e.phase === 'armed', 'Calibration recovers once phone settles');
}
{
  const e = new IdleCaptureEngine();
  feed(e, 0, FLAT_HOLD_MS + 20, () => [0, 0, 9.81]);
  e.push(FLAT_HOLD_MS + 40, 9.81, 0, 0);
  feed(e, FLAT_HOLD_MS + 60, 600, () => [0, 0, 9.81]);
  assert(e.phase !== 'rejected', 'One bad tilt sample must not reject capture');
}

console.log("idle-test-sensors ok");
