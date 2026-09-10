/** Pure scoring for the Rolls-Royce Start & Idle Test. No I/O. */

export function clamp(min: number, max: number, n: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Era slack: older cars are allowed more vibration. */
export function eraSlack(year: number): number {
  if (year < 1930) return 1.0;
  if (year < 1960) return 0.72;
  if (year < 1985) return 0.48;
  if (year < 2005) return 0.28;
  if (year < 2020) return 0.16;
  return 0.1;
}

/**
 * Extra slack by powertrain. Diesel idles rougher; EVs are already smooth.
 * Unknown / ice / petrol → 0.
 */
export function powertrainSlack(powertrain: string | null | undefined): number {
  const key = (powertrain ?? "ice").trim().toLowerCase();
  switch (key) {
    case "diesel":
      return 0.12;
    case "hybrid":
      return 0.04;
    case "ev":
    case "electric":
      return 0;
    case "ice":
    case "petrol":
    case "gasoline":
    case "other":
    default:
      return 0;
  }
}

export type IdleMetrics = {
  startDetected: boolean;
  startPeak: number;
  durationMs: number;
  rms: number;
  p2p: number;
  cv: number;
};

export type ScoreRunInput = IdleMetrics & {
  year: number;
  powertrain?: string | null;
  rrStandard?: number | null;
};

export type ScoreRunResult = {
  eraSlack: number;
  powertrainSlack: number;
  slack: number;
  startHarsh: number;
  idleHarsh: number;
  rawHarsh: number;
  adjustedHarsh: number;
  smooth01: number;
  displayScore: number;
};

export function toDisplayScore(smooth01: number, rrStandard: number | null | undefined): number {
  const std = Math.max(rrStandard ?? 0, 1e-6);
  return clamp(1, 10, Math.round(((10 * smooth01) / std) * 10) / 10);
}

export function scoreRun(input: ScoreRunInput): ScoreRunResult {
  const era = eraSlack(input.year);
  const pt = powertrainSlack(input.powertrain);
  const slack = clamp(0.08, 1.15, era + pt);
  const startHarsh = input.startPeak * 0.55 + (input.durationMs / 800) * 0.45;
  const idleHarsh = input.rms * 0.6 + input.p2p * 0.25 + input.cv * 0.15;
  const rawHarsh = input.startDetected ? startHarsh * 0.35 + idleHarsh * 0.65 : idleHarsh;
  const adjustedHarsh = rawHarsh / slack;
  const smooth01 = clamp(0, 1, 1 / (1 + 18 * adjustedHarsh));
  const displayScore = toDisplayScore(smooth01, input.rrStandard);
  return {
    eraSlack: era,
    powertrainSlack: pt,
    slack,
    startHarsh,
    idleHarsh,
    rawHarsh,
    adjustedHarsh,
    smooth01,
    displayScore,
  };
}
