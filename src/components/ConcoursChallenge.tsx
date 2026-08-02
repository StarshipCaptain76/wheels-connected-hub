import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useI18n } from "@/i18n/I18nProvider";
import { supabase } from "@/integrations/supabase/client";
import {
  getEventConcours,
  listConcoursQuestions,
  listConcoursVehicles,
  submitConcoursScore,
  type ConcoursAnswer,
} from "@/lib/concours.functions";
import { Trophy, Gift } from "lucide-react";

export function ConcoursChallenge({
  eventId,
  eventStartsAt,
}: {
  eventId: string;
  eventStartsAt?: string | null;
}) {
  const { lang } = useI18n();
  const qc = useQueryClient();
  const submit = useServerFn(submitConcoursScore);

  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useMemo(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
  }, []);

  const concours = useQuery({
    queryKey: ["concours", eventId],
    queryFn: () => getEventConcours({ data: { eventId } }),
  });
  const enabled = Boolean(concours.data?.enabled);

  const vehicles = useQuery({
    queryKey: ["concours-vehicles", eventId],
    queryFn: () => listConcoursVehicles({ data: { eventId } }),
    enabled,
  });
  const questions = useQuery({
    queryKey: ["concours-questions", concours.data?.selected_question_ids],
    queryFn: () =>
      listConcoursQuestions({ data: { ids: concours.data?.selected_question_ids ?? [] } }),
    enabled: enabled && Boolean(concours.data?.selected_question_ids?.length),
  });

  const [activeVehicle, setActiveVehicle] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, ConcoursAnswer>>({});
  const [busy, setBusy] = useState(false);

  if (!enabled) return null;

  const c = concours.data!;
  const prize = lang === "af" ? (c.prize_af ?? c.prize_en) : (c.prize_en ?? c.prize_af);

  const leaderboard = [...(vehicles.data ?? [])]
    .filter((v) => v.average_score != null)
    .sort((a, b) => (b.average_score ?? 0) - (a.average_score ?? 0));

  async function handleSubmit(vehicleId: string) {
    setBusy(true);
    try {
      const res = await submit({ data: { eventId, vehicleId, answers } });
      toast.success(
        lang === "af"
          ? `Punt ingedien: ${res.totalScore}/10`
          : `Score submitted: ${res.totalScore}/10`,
      );
      setActiveVehicle(null);
      setAnswers({});
      await qc.invalidateQueries({ queryKey: ["concours-vehicles", eventId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit score");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-10 space-y-4 rounded-xl border border-border bg-card p-5">
      <header className="flex flex-wrap items-center gap-3">
        <Trophy className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-bold">
          {lang === "af" ? "Concours-uitdaging" : "Concours Challenge"}
        </h2>
        {c.sponsor_name && (
          <span className="text-xs text-muted-foreground">
            {lang === "af" ? "Geborg deur" : "Sponsored by"} {c.sponsor_name}
          </span>
        )}
      </header>

      {prize && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Gift className="h-4 w-4" /> {prize}
        </p>
      )}

      {signedIn === false && (
        <p className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
          {lang === "af"
            ? "Teken in om te stem. Lede se stemme tel dubbel."
            : "Sign in to vote. Member votes carry full weight."}
        </p>
      )}

      {eventStartsAt && (
        <p className="text-xs text-muted-foreground">
          {new Date(eventStartsAt).toLocaleDateString(lang === "af" ? "af-ZA" : "en-ZA")}
        </p>
      )}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(vehicles.data ?? []).map((v) => (
          <li key={v.id} className="overflow-hidden rounded-lg border border-border">
            <img
              src={v.photo_url}
              alt={(lang === "af" ? v.label_af : v.label) ?? "Concours entry"}
              loading="lazy"
              className="h-40 w-full object-cover"
            />
            <div className="space-y-2 p-3">
              <p className="text-sm font-medium">
                {(lang === "af" ? v.label_af : v.label) ?? "—"}
              </p>
              {c.leaderboard_revealed && v.average_score != null && (
                <p className="text-xs text-muted-foreground">
                  {v.average_score}/10 · {v.submission_count}{" "}
                  {lang === "af" ? "stemme" : "votes"}
                </p>
              )}
              {signedIn && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveVehicle(activeVehicle === v.id ? null : v.id);
                    setAnswers({});
                  }}
                  className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                >
                  {activeVehicle === v.id
                    ? lang === "af"
                      ? "Sluit"
                      : "Close"
                    : lang === "af"
                      ? "Beoordeel"
                      : "Judge this car"}
                </button>
              )}

              {activeVehicle === v.id && (
                <div className="space-y-3 pt-2">
                  {(questions.data ?? []).map((q) => (
                    <div key={q.id}>
                      <p className="mb-1 text-xs font-medium">
                        {lang === "af" ? q.text_af : q.text_en}
                      </p>
                      {q.scoring_type === "yes_no" || q.scoring_type === "yes_no_na" ? (
                        <div className="flex gap-2">
                          {["yes", "no", ...(q.scoring_type === "yes_no_na" ? ["na"] : [])].map(
                            (opt) => (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                                className={`rounded-md border px-2 py-1 text-xs ${
                                  answers[q.id] === opt
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border"
                                }`}
                              >
                                {opt.toUpperCase()}
                              </button>
                            ),
                          )}
                        </div>
                      ) : (
                        <input
                          type="range"
                          min={1}
                          max={10}
                          value={typeof answers[q.id] === "number" ? Number(answers[q.id]) : 5}
                          onChange={(e) =>
                            setAnswers((a) => ({ ...a, [q.id]: Number(e.target.value) }))
                          }
                          className="w-full"
                        />
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleSubmit(v.id)}
                    className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
                  >
                    {lang === "af" ? "Dien punte in" : "Submit score"}
                  </button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      {c.leaderboard_revealed && leaderboard.length > 0 && (
        <div className="rounded-lg border border-border p-4">
          <h3 className="mb-2 text-sm font-semibold">
            {lang === "af" ? "Uitslae" : "Leaderboard"}
          </h3>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {leaderboard.map((v) => (
              <li key={v.id}>
                {(lang === "af" ? v.label_af : v.label) ?? "—"} — {v.average_score}/10
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
