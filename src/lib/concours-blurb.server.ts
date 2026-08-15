/**
 * Builds the light-hearted "why it won" blurb for the Concours Mini winner.
 * Server-only: called from an admin server function.
 */

type AnyClient = {
  from: (t: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => any;
};

type ScoreRow = {
  answers: Record<string, number | string | null> | null;
  total_score: number | null;
  weight: number | null;
};

type QuestionRow = {
  id: string;
  text_en: string;
  category: string | null;
  scoring_type: string;
};

export type WinnerBlurb = { en: string; af: string };

function summariseAnswers(scores: ScoreRow[], questions: QuestionRow[]) {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const agg = new Map<string, { sum: number; count: number; yes: number }>();

  for (const s of scores) {
    const answers = s.answers ?? {};
    for (const [qid, raw] of Object.entries(answers)) {
      if (!byId.has(qid)) continue;
      const cur = agg.get(qid) ?? { sum: 0, count: 0, yes: 0 };
      if (typeof raw === "number") {
        cur.sum += raw;
        cur.count += 1;
      } else if (raw === "yes" || raw === "no") {
        cur.count += 1;
        if (raw === "yes") cur.yes += 1;
        cur.sum += raw === "yes" ? 10 : 0;
      }
      agg.set(qid, cur);
    }
  }

  const rows = [...agg.entries()]
    .filter(([, v]) => v.count > 0)
    .map(([qid, v]) => {
      const q = byId.get(qid)!;
      return {
        question: q.text_en,
        category: q.category ?? "",
        average: Math.round((v.sum / v.count) * 10) / 10,
        votes: v.count,
      };
    })
    .sort((a, b) => b.average - a.average);

  return { best: rows.slice(0, 5), worst: rows.slice(-3).reverse() };
}

export async function buildWinnerBlurb(
  supabase: AnyClient,
  opts: {
    eventId: string;
    vehicleId: string;
    eventTitle: string;
    vehicleName: string;
    averageScore: number | null;
    submissionCount: number;
  },
): Promise<WinnerBlurb> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI is not configured — add the AI key and try again.");

  const { data: scores } = await supabase
    .from("event_concours_scores")
    .select("answers, total_score, weight")
    .eq("event_id", opts.eventId)
    .eq("vehicle_id", opts.vehicleId);

  const { data: questions } = await supabase
    .from("concours_questions")
    .select("id, text_en, category, scoring_type");

  const { best, worst } = summariseAnswers(
    (scores ?? []) as ScoreRow[],
    (questions ?? []) as QuestionRow[],
  );

  const facts = [
    `Event: ${opts.eventTitle}`,
    `Winning car: ${opts.vehicleName}`,
    `Weighted average score: ${opts.averageScore ?? "n/a"} out of 10 from ${opts.submissionCount} votes`,
    "Strongest scores:",
    ...best.map((r) => `- ${r.question} (${r.category}): ${r.average}/10 from ${r.votes} votes`),
    "Weakest scores:",
    ...worst.map((r) => `- ${r.question} (${r.category}): ${r.average}/10 from ${r.votes} votes`),
  ].join("\n");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "You write short, funny write-ups for a South African car club (Just Wheels - Hessequa) about the winner of a tongue-in-cheek 'Concours Mini' judging game. " +
            "Rules: 40-60 words per language. Playful and light-hearted, gently teasing the CAR only — never the owner, never anyone's looks, money, age or driving. " +
            "Be warm and respectful about the owner and the machine. Mention 1-2 of the actual winning categories and the score. " +
            "Afrikaans must read naturally for Southern Cape club members, not a literal translation. " +
            'Return ONLY JSON: {"en":"...","af":"..."}',
        },
        { role: "user", content: facts },
      ],
      temperature: 0.9,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    if (res.status === 429) throw new Error("AI is busy right now — try again in a moment.");
    throw new Error(`AI request failed (${res.status})`);
  }

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const raw = json.choices?.[0]?.message?.content?.trim() ?? "";
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

  try {
    const parsed = JSON.parse(cleaned) as { en?: string; af?: string };
    const en = (parsed.en ?? "").trim();
    const af = (parsed.af ?? "").trim();
    if (!en && !af) throw new Error("empty");
    return { en, af: af || en };
  } catch {
    throw new Error("Could not read the AI reply — try generating again.");
  }
}
