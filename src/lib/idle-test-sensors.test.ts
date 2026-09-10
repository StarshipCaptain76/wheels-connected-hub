import {
  IdleCaptureEngine,
  FLAT_HOLD_MS,
  BASELINE_MS,
  ARM_TIMEOUT_MS,
  IDLE_MS,
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
  const noisy = feed(e, FLAT_HOLD_MS + 50, BASELINE_MS + 50, (t) => [Math.sin(t / 8) * 3, 0, 9.81]);
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
  assert(e.phase === "start" || e.phase === "idle", `spike detected, got ${e.phase}`);
  feed(e, t, 2200, () => [0, 0, 9.81]);
  t += 2200;
  assert(e.phase === "idle", `then idle, got ${e.phase}`);
  feed(e, t, IDLE_MS + 40, () => [0, 0, 9.81]);
  assert(e.phase === "done", `idle 12s completes, got ${e.phase}`);
  const res = e.getResult();
  assert(res && res.ok && res.metrics.startDetected, "startDetected");
  assert(res && res.ok && res.samples.length > 0, "downsampled samples");
}

{
  const e = new IdleCaptureEngine();
  let t = 0;
  feed(e, t, FLAT_HOLD_MS + 20, () => [0, 0, 9.81]);
  t += FLAT_HOLD_MS + 20;
  feed(e, t, BASELINE_MS + 20, () => [0, 0, 9.81]);
  t += BASELINE_MS + 20;
  const after = feed(e, t, ARM_TIMEOUT_MS + 40, () => [0, 0, 9.81]);
  assert(after === "idle", `no spike by 18s is idle-only, got ${after}`);
}

{
  const e = new IdleCaptureEngine();
  feed(e, 0, FLAT_HOLD_MS + 20, () => [0, 0, 9.81]);
  const picked = e.push(FLAT_HOLD_MS + 40, 9.81, 0, 0);
  assert(picked.phase === "rejected", "tilt jump picked_up");
  assert(picked.rejectReason === "picked_up", "picked_up reason");
}

console.log("idle-test-sensors ok");
