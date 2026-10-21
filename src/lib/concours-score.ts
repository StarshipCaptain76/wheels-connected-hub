/** Equal question weights; N/A is excluded, never treated as a zero. */
export type ScoredQuestion = { id: string; scoring_type: "scale_1_10" | "yes_no" | "yes_no_na" | "count" };
export function scoreConcoursAnswers(answers: Record<string, number | string | null>, questions: ScoredQuestion[]) {
  if (!questions.length) throw new Error("No questions configured.");
  if (Object.keys(answers).some((id) => !questions.some((q) => q.id === id))) throw new Error("Unexpected question in your answers.");
  let sum = 0;
  let answered = 0;
  for (const q of questions) {
    const v = answers[q.id];
    if (q.scoring_type === "yes_no_na" && v === "na") continue;
    if (q.scoring_type === "yes_no" || q.scoring_type === "yes_no_na") {
      if (v !== "yes" && v !== "no") throw new Error("Please answer every question with a valid choice.");
      sum += v === "yes" ? 10 : 0;
    } else {
      const min = q.scoring_type === "count" ? 0 : 1;
      if (typeof v !== "number" || !Number.isFinite(v) || !Number.isInteger(v) || v < min || v > 10) throw new Error(`Choose a whole number from ${min} to 10.`);
      sum += v;
    }
    answered++;
  }
  if (!answered) throw new Error("At least one question must have a scored answer, not N/A.");
  return { totalScore: sum / answered, answered };
}

export function weightedAverage(scores: Array<{ total_score: number | null; weight: number | null }>) {
  let total = 0, weight = 0, count = 0;
  for (const s of scores) {
    if (s.total_score == null || !Number.isFinite(Number(s.total_score))) continue;
    const w = Number(s.weight);
    if (!Number.isFinite(w) || w <= 0) continue;
    total += Number(s.total_score) * w;
    weight += w;
    count++;
  }
  return { average: weight > 0 ? total / weight : null, count };
}

export function firstPlaceIds(vehicles: Array<{ id: string; average_score?: number | null }>) {
  const scored = vehicles.filter((v) => v.average_score != null);
  const best = Math.max(...scored.map((v) => v.average_score ?? -Infinity));
  return scored.filter((v) => Math.abs((v.average_score ?? -Infinity) - best) < 1e-10).map((v) => v.id).sort();
}