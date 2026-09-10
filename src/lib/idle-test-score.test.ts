import { eraSlack, powertrainSlack, scoreRun, toDisplayScore } from "./idle-test-score.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(eraSlack(1920) === 1.0, "1920 eraSlack");
assert(eraSlack(1929) === 1.0, "1929 eraSlack");
assert(eraSlack(1930) === 0.72, "1930 eraSlack");
assert(eraSlack(1959) === 0.72, "1959 eraSlack");
assert(eraSlack(1960) === 0.48, "1960 eraSlack");
assert(eraSlack(1984) === 0.48, "1984 eraSlack");
assert(eraSlack(1985) === 0.28, "1985 eraSlack");
assert(eraSlack(2004) === 0.28, "2004 eraSlack");
assert(eraSlack(2005) === 0.16, "2005 eraSlack");
assert(eraSlack(2019) === 0.16, "2019 eraSlack");
assert(eraSlack(2020) === 0.1, "2020 eraSlack");
assert(eraSlack(2025) === 0.1, "2025 eraSlack");

assert(powertrainSlack("diesel") === 0.12, "diesel slack");
assert(powertrainSlack("ice") === 0, "ice slack");
assert(powertrainSlack(null) === 0, "null slack");

const metrics = {
  startDetected: true,
  startPeak: 0.4,
  durationMs: 600,
  rms: 0.08,
  p2p: 0.2,
  cv: 0.1,
};

const old = scoreRun({ ...metrics, year: 1920, powertrain: "ice", rrStandard: 1 });
const neu = scoreRun({ ...metrics, year: 2025, powertrain: "ice", rrStandard: 1 });
assert(old.rawHarsh === neu.rawHarsh, "same raw harshness");
assert(old.smooth01 > neu.smooth01, "1920 smoother after slack than 2025");
assert(old.displayScore > neu.displayScore, "1920 beats 2025 on display");
assert(old.slack === 1.0, "1920 slack is era only");
assert(neu.slack === 0.1, "2025 slack is era only");

const ten = toDisplayScore(0.5, 0.5);
assert(ten === 10, "standard scores 10");
const five = toDisplayScore(0.25, 0.5);
assert(five === 5, "half smoothness is 5");

const older = scoreRun({ ...metrics, year: 1920, powertrain: "ice" });
const newer = scoreRun({ ...metrics, year: 2025, powertrain: "ice" });
const rr = Math.max(older.smooth01, newer.smooth01);
assert(toDisplayScore(rr, rr) === 10, "smoother age-adjusted is 10.0");
const ratio = toDisplayScore(Math.min(older.smooth01, newer.smooth01), rr);
const expected = Math.max(
  1,
  Math.min(10, Math.round((10 * newer.smooth01) / rr * 10) / 10),
);
assert(ratio === expected, `other is ratio got ${ratio} expected ${expected}`);
assert(ratio < 10, "non-standard is below 10");

console.log("idle-test-score ok", {
  old: { slack: old.slack, smooth01: old.smooth01, display: old.displayScore },
  neu: { slack: neu.slack, smooth01: neu.smooth01, display: neu.displayScore },
});
