import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getEventConcours,
  listConcoursQuestions,
  listConcoursVehicles,
  submitConcoursScore,
  type ConcoursQuestion,
  type ConcoursVehicle,
} from "@/lib/concours.functions";
import { useI18n } from "@/i18n/I18nProvider";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, ChevronLeft, ChevronRight, Check } from "lucide-react";

type Props = {
  eventId: string;
  /** Event start date ISO — questions only visible on the day */
  eventStartsAt: string;
};

export function ConcoursChallenge({ eventId, eventStartsAt }: Props) {
  const { lang } = useI18n();
  const qc = useQueryClient();
  const submit = useServerFn(submitConcoursScore);

  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      setSignedIn(!!session);
      if (session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("membership_status")
          .eq("id", session.user.id)
          .maybeSingle();
        setIsMember(
          profile?.membership_status === "active" ||
            profile?.membership_status === "member",
        );
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSignedIn(!!s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const concoursQ = useQuery({
    queryKey: ["concours", eventId],
    queryFn: () => getEventConcours({ data: { eventId } }),
  });

  const vehiclesQ = useQuery({
    queryKey: ["concours-vehicles", eventId],
    enabled: !!concoursQ.data?.enabled,
    queryFn: () => listConcoursVehicles({ data: { eventId } }),
    refetchInterval: concoursQ.data?.leaderboard_revealed ? 15_000 : false,
  });

  const questionsQ = useQuery({
    queryKey: ["concours-questions", eventId, concoursQ.data?.selected_question_ids],
    enabled: !!concoursQ.data?.selected_question_ids?.length,
    queryFn: () =>
      listConcoursQuestions({
        data: { ids: concoursQ.data!.selected_question_ids },
      }),
  });

  // Gating: only on event day (local calendar day of starts_at)
  const isEventDay = useMemo(() => {
    const start = new Date(eventStartsAt);
    const now = new Date();
    return (
      start.getFullYear() === now.getFullYear() &&
      start.getMonth() === now.getMonth() &&
      start.getDate() === now.getDate()
    );
  }, [eventStartsAt]);

  const [selectedVehicle, setSelectedVehicle] = useState<ConcoursVehicle | null>(null);
  const [answers, setAnswers] = useState<Record<string, number | string | null>>({});
  const [qIdx, setQIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  const c = concoursQ.data;
  const vehicles = vehiclesQ.data ?? [];
  const allQuestions = questionsQ.data ?? [];

  // Public only gets first 50%
  const questions = useMemo(() => {
    if (isMember) return allQuestions;
    const half = Math.ceil(allQuestions.length / 2);
    return allQuestions.slice(0, half);
  }, [allQuestions, isMember]);

  if (concoursQ.isLoading) return null;
  if (!c?.enabled) return null;

  // Pre-event teaser
  if (!isEventDay) {
    return (
      <section className="mt-8 rounded-lg border-2 border-primary/50 bg-primary/5 p-5">
        <h2 className="flex items-center gap-2 font-display text-2xl text-ink">
          <Trophy className="h-6 w-6 text-primary" />
          {lang === "af" ? "Concours Mini" : "Concours Mini"}
        </h2>
        <p className="mt-2 text-sm text-ink/80">
          {lang === "af"
            ? "Daar is ’n ligte, snaakse Concours-uitdaging op die dag self. Kom kyk, lag en stem!"
            : "There’ll be a light, tongue-in-cheek Concours challenge on the day. Come look, laugh and score!"}
        </p>
        {c.prize_en && (
          <p className="mt-2 text-sm font-bold text-primary">
            {lang === "af" && c.prize_af ? c.prize_af : c.prize_en}
          </p>
        )}
        {c.sponsor_name && (
          <p className="mt-1 text-xs text-ink/60">
            {lang === "af" ? "Geborg deur" : "Sponsored by"} {c.sponsor_name}
          </p>
        )}
        {c.sponsor_logo_url && (
          <img
            src={c.sponsor_logo_url}
            alt={c.sponsor_name ?? ""}
            className="mt-2 h-10 object-contain"
          />
        )}
      </section>
    );
  }

  // Event day but no vehicles yet
  if (vehicles.length === 0) {
    return (
      <section className="mt-8 rounded-lg border-2 border-ink bg-card p-5">
        <h2 className="flex items-center gap-2 font-display text-2xl text-ink">
          <Trophy className="h-6 w-6 text-primary" />
          Concours Mini
        </h2>
        <p className="mt-2 text-sm text-ink/70">
          {lang === "af"
            ? "Voertuie word nog bygevoeg — kyk later weer."
            : "Vehicles are still being added — check back shortly."}
        </p>
      </section>
    );
  }

  async function handleSubmit() {
    if (!selectedVehicle) return;
    setBusy(true);
    setDoneMsg(null);
    try {
      const res = await submit({
        data: {
          eventId,
          vehicleId: selectedVehicle.id,
          answers,
        },
      });
      setDoneMsg(
        lang === "af"
          ? `Ingedien! Jou telling: ${res.totalScore}`
          : `Submitted! Your score: ${res.totalScore}`,
      );
      await qc.invalidateQueries({ queryKey: ["concours-vehicles", eventId] });
      setSelectedVehicle(null);
      setAnswers({});
      setQIdx(0);
    } catch (err) {
      setDoneMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  // Scoring form for a selected vehicle
  if (selectedVehicle) {
    const q = questions[qIdx];
    const text = q
      ? lang === "af" && q.text_af
        ? q.text_af
        : q.text_en
      : "";
    const cat =
      q && lang === "af" && q.category_af ? q.category_af : q?.category;

    return (
      <section className="mt-8 rounded-lg border-2 border-ink bg-card p-5">
        <button
          type="button"
          onClick={() => {
            setSelectedVehicle(null);
            setAnswers({});
            setQIdx(0);
          }}
          className="mb-3 inline-flex items-center gap-1 text-sm text-ink/60 hover:text-primary"
        >
          <ChevronLeft className="h-4 w-4" />
          {lang === "af" ? "Terug na voertuie" : "Back to vehicles"}
        </button>

        <div className="flex gap-3">
          <img
            src={selectedVehicle.photo_url}
            alt=""
            className="h-20 w-28 rounded border-2 border-ink object-cover"
          />
          <div>
            <p className="font-display text-xl text-ink">
              {lang === "af" && selectedVehicle.label_af
                ? selectedVehicle.label_af
                : selectedVehicle.label || "Vehicle"}
            </p>
            <p className="text-xs text-ink/60">
              {lang === "af"
                ? `${questions.length} vrae · ${isMember ? "volledige stem" : "50% openbare stem"}`
                : `${questions.length} questions · ${isMember ? "full member vote" : "50% public vote"}`}
            </p>
          </div>
        </div>

        {q && (
          <div className="mt-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
              {cat} · {qIdx + 1}/{questions.length}
            </p>
            <p className="mt-1 text-lg font-bold text-ink">{text}</p>

            <div className="mt-4">
              {q.scoring_type === "scale_1_10" && (
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setAnswers((a) => ({ ...a, [q.id]: n }))}
                      className={`h-10 w-10 rounded-md border-2 border-ink text-sm font-bold ${
                        answers[q.id] === n
                          ? "bg-primary text-paper"
                          : "bg-paper text-ink hover:bg-ink hover:text-paper"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}

              {(q.scoring_type === "yes_no" || q.scoring_type === "yes_no_na") && (
                <div className="flex flex-wrap gap-2">
                  {(["yes", "no"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setAnswers((a) => ({ ...a, [q.id]: v }))}
                      className={`rounded-md border-2 border-ink px-5 py-2 text-sm font-bold uppercase ${
                        answers[q.id] === v
                          ? "bg-primary text-paper"
                          : "bg-paper text-ink"
                      }`}
                    >
                      {v === "yes"
                        ? lang === "af"
                          ? "Ja"
                          : "Yes"
                        : lang === "af"
                          ? "Nee"
                          : "No"}
                    </button>
                  ))}
                  {q.scoring_type === "yes_no_na" && (
                    <button
                      type="button"
                      onClick={() => setAnswers((a) => ({ ...a, [q.id]: "na" }))}
                      className={`rounded-md border-2 border-ink px-5 py-2 text-sm font-bold uppercase ${
                        answers[q.id] === "na"
                          ? "bg-primary text-paper"
                          : "bg-paper text-ink"
                      }`}
                    >
                      N/A
                    </button>
                  )}
                </div>
              )}

              {q.scoring_type === "count" && (
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={(answers[q.id] as number) ?? ""}
                  onChange={(e) =>
                    setAnswers((a) => ({
                      ...a,
                      [q.id]: e.target.value === "" ? null : Number(e.target.value),
                    }))
                  }
                  className="w-24 rounded-md border-2 border-ink bg-paper px-3 py-2"
                />
              )}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                disabled={qIdx === 0}
                onClick={() => setQIdx((i) => i - 1)}
                className="inline-flex items-center gap-1 rounded-md border-2 border-ink bg-paper px-3 py-2 text-sm font-bold disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                {lang === "af" ? "Vorige" : "Prev"}
              </button>

              {qIdx < questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setQIdx((i) => i + 1)}
                  className="inline-flex items-center gap-1 rounded-md border-2 border-ink bg-primary px-4 py-2 text-sm font-bold uppercase text-paper"
                >
                  {lang === "af" ? "Volgende" : "Next"}
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleSubmit}
                  className="inline-flex items-center gap-1 rounded-md border-2 border-ink bg-primary px-4 py-2 text-sm font-bold uppercase text-paper disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  {busy
                    ? lang === "af"
                      ? "Stuur…"
                      : "Sending…"
                    : lang === "af"
                      ? "Dien in"
                      : "Submit score"}
                </button>
              )}
            </div>
          </div>
        )}
      </section>
    );
  }

  // Vehicle picker + optional leaderboard
  return (
    <section className="mt-8 rounded-lg border-2 border-ink bg-card p-5">
      <h2 className="flex items-center gap-2 font-display text-2xl text-ink">
        <Trophy className="h-6 w-6 text-primary" />
        Concours Mini
      </h2>

      {(c.prize_en || c.prize_af) && (
        <p className="mt-1 text-sm font-bold text-primary">
          {lang === "af" && c.prize_af ? c.prize_af : c.prize_en}
        </p>
      )}
      {c.sponsor_name && (
        <div className="mt-1 flex items-center gap-2 text-xs text-ink/60">
          <span>
            {lang === "af" ? "Geborg deur" : "Sponsored by"} {c.sponsor_name}
          </span>
          {c.sponsor_logo_url && (
            <img src={c.sponsor_logo_url} alt="" className="h-6 object-contain" />
          )}
        </div>
      )}

      <p className="mt-3 text-sm text-ink/70">
        {lang === "af"
          ? isMember
            ? "Kies ’n voertuig en stem met die volle lys vrae."
            : "Kies ’n voertuig en stem met 50% van die vrae (openbare stem)."
          : isMember
            ? "Pick a vehicle and score it with the full question set."
            : "Pick a vehicle and score it with 50% of the questions (public vote)."}
      </p>

      {doneMsg && <p className="mt-2 text-sm font-bold text-primary">{doneMsg}</p>}

      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {vehicles.map((v) => (
          <li key={v.id}>
            <button
              type="button"
              onClick={() => {
                setSelectedVehicle(v);
                setAnswers({});
                setQIdx(0);
                setDoneMsg(null);
              }}
              className="flex w-full gap-3 rounded-lg border-2 border-ink bg-paper p-2 text-left transition hover:border-primary hover:shadow-[3px_3px_0_0_var(--color-primary)]"
            >
              <img
                src={v.photo_url}
                alt=""
                className="h-16 w-20 rounded border border-ink object-cover"
              />
              <div className="min-w-0">
                <p className="truncate font-bold text-ink">
                  {lang === "af" && v.label_af ? v.label_af : v.label || "Vehicle"}
                </p>
                <p className="text-xs text-ink/60">
                  {v.submission_count ?? 0}{" "}
                  {lang === "af" ? "stemme" : "scores"}
                  {c.leaderboard_revealed && v.average_score != null
                    ? ` · ${v.average_score}`
                    : ""}
                </p>
              </div>
            </button>
          </li>
        ))}
      </ul>

      {c.leaderboard_revealed && (
        <div className="mt-6">
          <h3 className="font-display text-xl text-ink">
            {lang === "af" ? "Ranglys" : "Leaderboard"}
          </h3>
          <ol className="mt-2 space-y-1">
            {[...vehicles]
              .filter((v) => v.average_score != null)
              .sort((a, b) => (b.average_score ?? 0) - (a.average_score ?? 0))
              .map((v, i) => (
                <li
                  key={v.id}
                  className="flex items-center justify-between rounded border-2 border-ink bg-paper px-3 py-2 text-sm"
                >
                  <span>
                    <span className="mr-2 font-bold text-primary">#{i + 1}</span>
                    {lang === "af" && v.label_af ? v.label_af : v.label || "Vehicle"}
                  </span>
                  <span className="font-bold">
                    {v.average_score}
                    <span className="ml-1 text-xs font-normal text-ink/50">
                      ({v.submission_count})
                    </span>
                  </span>
                </li>
              ))}
          </ol>
        </div>
      )}
    </section>
  );
}
