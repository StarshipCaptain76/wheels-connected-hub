import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getEventConcours,
  upsertEventConcours,
  revealConcoursLeaderboard,
  listConcoursVehiclesAdmin,
  deleteConcoursVehicle,
  listAllConcoursQuestionsAdmin,
  listConcoursQuestions,
  upsertConcoursQuestion,
  publishConcoursResults,
  listConcoursScoresAdmin,
  updateConcoursScoreAdmin,
  deleteConcoursScoreAdmin,
  type EventConcours,
  type ConcoursQuestion,
  type ConcoursScoreRow,
} from "@/lib/concours.functions";
import { ImageUploadField } from "@/components/ImageUploadField";
import { Trophy, Eye, EyeOff, RefreshCw, Camera, Plus, Pencil } from "lucide-react";

type Props = { eventId: string | undefined; hasDestination?: boolean };

export function ConcoursAdminPanel({ eventId, hasDestination }: Props) {
  const qc = useQueryClient();
  const upsert = useServerFn(upsertEventConcours);
  const reveal = useServerFn(revealConcoursLeaderboard);
  const upsertQ = useServerFn(upsertConcoursQuestion);
  const publish = useServerFn(publishConcoursResults);
  const updateScore = useServerFn(updateConcoursScoreAdmin);
  const delScore = useServerFn(deleteConcoursScoreAdmin);
  const delVehicle = useServerFn(deleteConcoursVehicle);
  const [adminTab, setAdminTab] = useState<"settings" | "questions" | "scores" | "results">("settings");


  const concoursQ = useQuery({
    queryKey: ["concours", eventId],
    enabled: !!eventId,
    queryFn: () => getEventConcours({ data: { eventId: eventId! } }),
  });
  const vehiclesQ = useQuery({
    queryKey: ["concours-vehicles-admin", eventId],
    enabled: !!eventId,
    queryFn: () => listConcoursVehiclesAdmin({ data: { eventId: eventId! } }),
  });
  const questionsQ = useQuery({
    queryKey: ["concours-questions-admin"],
    enabled: !!eventId,
    queryFn: () => listAllConcoursQuestionsAdmin(),
  });
  const pickedIds = concoursQ.data?.selected_question_ids ?? [];
  const pickedQ = useQuery({
    queryKey: ["concours-questions-picked", eventId, pickedIds],
    enabled: !!eventId && pickedIds.length > 0,
    queryFn: () => listConcoursQuestions({ data: { ids: pickedIds } }),
  });
  const scoresQ = useQuery({
    queryKey: ["concours-scores-admin", eventId],
    enabled: !!eventId && adminTab === "scores",
    queryFn: () => listConcoursScoresAdmin({ data: { eventId: eventId! } }),
  });

  const [enabled, setEnabled] = useState(false);
  const [questionCount, setQuestionCount] = useState(10);
  const [prizeEn, setPrizeEn] = useState("");
  const [prizeAf, setPrizeAf] = useState("");
  const [sponsorName, setSponsorName] = useState("");
  const [sponsorLogoUrl, setSponsorLogoUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Results form
  const [winnerVehicleId, setWinnerVehicleId] = useState<string>("");
  const [winnerPhotoUrl, setWinnerPhotoUrl] = useState("");
  const [winnerHeadlineEn, setWinnerHeadlineEn] = useState("");
  const [winnerHeadlineAf, setWinnerHeadlineAf] = useState("");
  const [winnerBlurbEn, setWinnerBlurbEn] = useState("");
  const [winnerBlurbAf, setWinnerBlurbAf] = useState("");
  const [blurbBusy, setBlurbBusy] = useState(false);

  const [resultsOnHome, setResultsOnHome] = useState(false);

  // Question editor
  const [editingQ, setEditingQ] = useState<Partial<ConcoursQuestion> & { scoring_type?: string } | null>(null);

  useEffect(() => {
    const c = concoursQ.data;
    if (c) {
      setEnabled(c.enabled);
      setQuestionCount(c.question_count);
      setPrizeEn(c.prize_en ?? "");
      setPrizeAf(c.prize_af ?? "");
      setSponsorName(c.sponsor_name ?? "");
      setSponsorLogoUrl(c.sponsor_logo_url ?? "");
      setWinnerVehicleId(c.winner_vehicle_id ?? "");
      setWinnerPhotoUrl(c.winner_photo_url ?? "");
      setWinnerHeadlineEn(c.winner_headline_en ?? "");
      setWinnerHeadlineAf(c.winner_headline_af ?? "");
      setWinnerBlurbEn(c.winner_blurb_en ?? "");
      setWinnerBlurbAf(c.winner_blurb_af ?? "");
      setResultsOnHome(!!c.results_on_home);

    }
  }, [concoursQ.data]);

  if (!eventId) {
    return (
      <p className="text-sm text-ink/60">
        Save the event first, then open this tab to enable Concours Mini.
      </p>
    );
  }

  async function save(reRoll = false) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await upsert({
        data: {
          eventId: eventId!,
          enabled,
          questionCount,
          prizeEn: prizeEn || null,
          prizeAf: prizeAf || null,
          sponsorName: sponsorName || null,
          sponsorLogoUrl: sponsorLogoUrl || null,
          reRollQuestions: reRoll,
        },
      });
      setMsg(
        reRoll
          ? `Questions re-rolled (${res.selectedCount} selected)`
          : `Saved · ${res.selectedCount} questions ready`,
      );
      await qc.invalidateQueries({ queryKey: ["concours", eventId] });
      await qc.invalidateQueries({ queryKey: ["concours-questions-picked", eventId] });
      await qc.invalidateQueries({ queryKey: ["concours-questions", eventId] });
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleReveal() {
    if (!concoursQ.data) return;
    setBusy(true);
    try {
      await reveal({
        data: { eventId: eventId!, revealed: !concoursQ.data.leaderboard_revealed },
      });
      await qc.invalidateQueries({ queryKey: ["concours", eventId] });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveQuestion() {
    if (!editingQ?.text_en || !editingQ?.text_af || !editingQ?.category) {
      alert("Category + EN + AF text required");
      return;
    }
    setBusy(true);
    try {
      await upsertQ({
        data: {
          id: editingQ.id ?? null,
          category: editingQ.category,
          categoryAf: editingQ.category_af ?? null,
          textEn: editingQ.text_en,
          textAf: editingQ.text_af,
          scoringType: (editingQ.scoring_type as "scale_1_10" | "yes_no" | "yes_no_na" | "count") ?? "scale_1_10",
          sortOrder: editingQ.sort_order ?? 0,
          active: editingQ.active !== false,
        },
      });
      setEditingQ(null);
      await qc.invalidateQueries({ queryKey: ["concours-questions-admin"] });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function deactivateQuestion(id: string) {
    if (!confirm("Deactivate this question?")) return;
    setBusy(true);
    try {
      const q = questionsQ.data?.find((x) => x.id === id);
      if (!q) return;
      await upsertQ({
        data: {
          id: q.id,
          category: q.category,
          categoryAf: q.category_af,
          textEn: q.text_en,
          textAf: q.text_af,
          scoringType: q.scoring_type,
          sortOrder: q.sort_order,
          active: false,
        },
      });
      await qc.invalidateQueries({ queryKey: ["concours-questions-admin"] });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveResults() {
    setBusy(true);
    setMsg(null);
    try {
      await publish({
        data: {
          eventId: eventId!,
          winnerVehicleId: winnerVehicleId || null,
          winnerPhotoUrl: winnerPhotoUrl || null,
          winnerHeadlineEn: winnerHeadlineEn || null,
          winnerHeadlineAf: winnerHeadlineAf || null,
          resultsOnHome,
        },
      });
      setMsg(resultsOnHome ? "Published on home page" : "Results saved (not on home)");
      await qc.invalidateQueries({ queryKey: ["concours", eventId] });
      await qc.invalidateQueries({ queryKey: ["concours-home-winner"] });
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  }

  const c: EventConcours | null = concoursQ.data ?? null;
  const vehicles = vehiclesQ.data ?? [];
  const vehicleCount = vehicles.length;
  // vehicles sorted by score for winner picker
  const ranked = [...vehicles]
    .filter((v) => v.average_score != null)
    .sort((a, b) => (b.average_score ?? 0) - (a.average_score ?? 0));

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b-2 border-ink text-[10px] font-bold uppercase tracking-wider">
        {(["settings", "questions", "scores", "results"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setAdminTab(t)}
            className={`rounded-t border-2 border-b-0 px-3 py-1.5 ${
              adminTab === t ? "border-ink bg-ink text-paper" : "border-transparent text-ink/60"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {adminTab === "settings" && (
        <div className="space-y-4">
          {hasDestination === false && (
            <p className="rounded-md border-2 border-primary bg-primary/10 px-3 py-2 text-sm text-primary">
              This event has no destination map pin. Concours Mini check-in and scoring need
              coordinates. Set them on the Destination tab, then Save event.
            </p>
          )}
          <div className="rounded-lg border-2 border-primary/40 bg-primary/5 p-3 text-sm text-ink/80">
            <p className="font-bold text-primary">Concours Mini</p>
            <p className="mt-1">
              Enable here. On the day: club members sign in and GPS check-in on the event page.
              Spectators score without an account (GPS checked when they submit). Admins add cars
              with [+].
            </p>
          </div>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm font-bold">Enable Concours Mini for this event</span>
          </label>

          {enabled && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-ink/70">
                    Questions for this event (5–15)
                  </span>
                  <input
                    type="number"
                    min={5}
                    max={15}
                    value={questionCount}
                    onChange={(e) =>
                      setQuestionCount(Math.max(5, Math.min(15, Number(e.target.value) || 10)))
                    }
                    className={inp}
                  />
                </label>
                <div className="flex items-end">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => save(true)}
                    className="inline-flex items-center gap-1 rounded-md border-2 border-ink bg-paper px-3 py-2 text-xs font-bold uppercase disabled:opacity-50"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Shuffle from full bank
                  </button>
                </div>
              </div>

              <div className="rounded-lg border-2 border-ink/20 bg-paper p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-primary">
                  This event’s questions ({pickedQ.data?.length ?? pickedIds.length}
                  {questionCount ? ` of ${questionCount}` : ""})
                </p>
                <p className="mt-1 text-xs text-ink/60">
                  Drawn at random from every active question. Shuffle to draw a new set. Save
                  settings does not reshuffle an existing set.
                </p>
                {pickedIds.length === 0 ? (
                  <p className="mt-2 text-sm text-ink/60">
                    Save settings to draw the first random set.
                  </p>
                ) : pickedQ.isLoading ? (
                  <p className="mt-2 text-sm text-ink/60">Loading picked questions…</p>
                ) : (
                  <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm">
                    {(pickedQ.data ?? []).map((q) => (
                      <li key={q.id}>
                        <span className="text-[10px] font-bold uppercase text-primary">
                          {q.category}
                        </span>
                        <span className="ml-1 text-ink">{q.text_en}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-ink/70">Prize (EN)</span>
                <input value={prizeEn} onChange={(e) => setPrizeEn(e.target.value)} className={inp} />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-ink/70">Prize (AF)</span>
                <input value={prizeAf} onChange={(e) => setPrizeAf(e.target.value)} className={inp} />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-ink/70">
                  Sponsor name (optional)
                </span>
                <input
                  value={sponsorName}
                  onChange={(e) => setSponsorName(e.target.value)}
                  className={inp}
                />
              </label>
              <ImageUploadField
                label="Sponsor logo (optional)"
                value={sponsorLogoUrl}
                onChange={(v) => setSponsorLogoUrl(v || "")}
                bucket="gallery"
                folder="events/concours-sponsors"
                maxMb={2}
              />

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => save(false)}
                  className="rounded-md border-2 border-ink bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-paper disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Save settings"}
                </button>
                {c && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={toggleReveal}
                    className="inline-flex items-center gap-1 rounded-md border-2 border-ink bg-paper px-4 py-2 text-sm font-bold uppercase disabled:opacity-50"
                  >
                    {c.leaderboard_revealed ? (
                      <>
                        <EyeOff className="h-4 w-4" /> Hide leaderboard
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4" /> Reveal leaderboard
                      </>
                    )}
                  </button>
                )}
              </div>
              {msg && <p className="text-sm font-bold text-primary">{msg}</p>}

              <div className="flex items-start gap-2 rounded-lg border-2 border-dashed border-ink/30 p-3 text-sm text-ink/70">
                <Camera className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-ink">
                    Vehicles on event page ({vehicleCount} so far)
                  </p>
                  <p className="mt-0.5">
                    Admins check in on site, then use [+] on the public event page.
                  </p>
                  {vehicles.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {vehicles.map((v) => (
                        <li
                          key={v.id}
                          className="flex items-center justify-between gap-2 rounded border border-ink/20 bg-paper px-2 py-1 text-xs text-ink"
                        >
                          <span className="truncate">
                            {v.tagged_display_name || v.label || "Vehicle"}
                            {v.average_score != null ? ` · ${v.average_score}` : ""}
                          </span>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={async () => {
                              if (!confirm("Remove this vehicle and its scores?")) return;
                              setBusy(true);
                              try {
                                await delVehicle({ data: { vehicleId: v.id } });
                                await qc.invalidateQueries({ queryKey: ["concours-vehicles-admin", eventId] });
                                await qc.invalidateQueries({ queryKey: ["concours-vehicles", eventId] });
                                await qc.invalidateQueries({
                                  queryKey: ["concours-scores-admin", eventId],
                                });
                              } catch (err) {
                                alert(err instanceof Error ? err.message : "Delete failed");
                              } finally {
                                setBusy(false);
                              }
                            }}
                            className="shrink-0 text-[10px] font-bold uppercase text-primary"
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {adminTab === "questions" && (
        <div className="space-y-3">
          <p className="text-xs text-ink/60">
            Master question bank for every event. This is the full list — the set drawn for this
            event is on the Settings tab. Edit scoring type and bilingual text here.
          </p>
          <button
            type="button"
            onClick={() =>
              setEditingQ({
                category: "Quirks & Character",
                text_en: "",
                text_af: "",
                scoring_type: "scale_1_10",
                sort_order: (questionsQ.data?.length ?? 0) + 1,
              })
            }
            className="inline-flex items-center gap-1 rounded-md border-2 border-ink bg-primary px-3 py-1.5 text-xs font-bold uppercase text-paper"
          >
            <Plus className="h-3.5 w-3.5" /> Add question
          </button>

          {editingQ && (
            <div className="space-y-2 rounded-lg border-2 border-primary/40 bg-primary/5 p-3">
              <label className="block text-xs font-bold uppercase">
                Category (EN)
                <input
                  value={editingQ.category ?? ""}
                  onChange={(e) => setEditingQ({ ...editingQ, category: e.target.value })}
                  className={inp}
                />
              </label>
              <label className="block text-xs font-bold uppercase">
                Category (AF)
                <input
                  value={editingQ.category_af ?? ""}
                  onChange={(e) => setEditingQ({ ...editingQ, category_af: e.target.value })}
                  className={inp}
                />
              </label>
              <label className="block text-xs font-bold uppercase">
                Question (EN)
                <textarea
                  value={editingQ.text_en ?? ""}
                  onChange={(e) => setEditingQ({ ...editingQ, text_en: e.target.value })}
                  className={inp}
                  rows={2}
                />
              </label>
              <label className="block text-xs font-bold uppercase">
                Question (AF)
                <textarea
                  value={editingQ.text_af ?? ""}
                  onChange={(e) => setEditingQ({ ...editingQ, text_af: e.target.value })}
                  className={inp}
                  rows={2}
                />
              </label>
              <label className="block text-xs font-bold uppercase">
                Scoring
                <select
                  value={editingQ.scoring_type ?? "scale_1_10"}
                  onChange={(e) => setEditingQ({ ...editingQ, scoring_type: e.target.value as NonNullable<typeof editingQ.scoring_type> })}
                  className={inp}
                >
                  <option value="scale_1_10">1–10 scale</option>
                  <option value="yes_no">Yes / No</option>
                  <option value="yes_no_na">Yes / No / N/A</option>
                  <option value="count">Count (number)</option>
                </select>
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={saveQuestion}
                  className="rounded-md border-2 border-ink bg-primary px-3 py-1.5 text-xs font-bold uppercase text-paper"
                >
                  Save question
                </button>
                <button
                  type="button"
                  onClick={() => setEditingQ(null)}
                  className="rounded-md border-2 border-ink bg-paper px-3 py-1.5 text-xs font-bold uppercase"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <ul className="max-h-72 space-y-2 overflow-y-auto">
            {(questionsQ.data ?? []).map((q) => (
              <li
                key={q.id}
                className={`flex items-start justify-between gap-2 rounded border-2 border-ink/20 bg-paper p-2 text-sm ${
                  q.active === false ? "opacity-55" : ""
                }`}
              >
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase text-primary">
                    {q.category} · {q.scoring_type}
                    {q.active === false ? " · inactive" : ""}
                  </p>
                  <p className="font-bold text-ink">{q.text_en}</p>
                  <p className="text-xs text-ink/60">{q.text_af}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => setEditingQ(q)}
                    className="rounded border border-ink p-1"
                    title="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deactivateQuestion(q.id)}
                    className="rounded border border-primary px-1.5 text-[10px] font-bold uppercase text-primary"
                  >
                    Off
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}


      {adminTab === "scores" && (
        <div className="space-y-3">
          <p className="text-xs text-ink/60">
            Edit or delete individual Concours scores. Changing a score updates the live average.
          </p>
          {(scoresQ.data ?? []).length === 0 && (
            <p className="text-sm text-ink/50">No scores submitted yet.</p>
          )}
          <ul className="max-h-96 space-y-2 overflow-y-auto">
            {(scoresQ.data ?? []).map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border-2 border-ink/20 bg-paper p-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-bold text-ink">
                    {s.display_name || (s.is_member ? "Member" : "Spectator")}
                    {s.member_number != null ? ` #${s.member_number}` : ""}
                  </p>
                  <p className="text-xs text-ink/60">
                    {s.vehicle_label || "Vehicle"} · weight {s.weight}
                    {s.submitted_at
                      ? ` · ${new Date(s.submitted_at).toLocaleString()}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={10}
                    step={0.1}
                    defaultValue={s.total_score ?? ""}
                    className="w-16 rounded border-2 border-ink bg-paper px-2 py-1 text-sm font-bold"
                    onBlur={async (e) => {
                      const v = e.target.value === "" ? null : Number(e.target.value);
                      if (v === s.total_score) return;
                      setBusy(true);
                      try {
                        await updateScore({
                          data: { scoreId: s.id, totalScore: v },
                        });
                        await qc.invalidateQueries({ queryKey: ["concours-scores-admin", eventId] });
                        await qc.invalidateQueries({ queryKey: ["concours-vehicles-admin", eventId] });
                        await qc.invalidateQueries({ queryKey: ["concours-vehicles", eventId] });
                      } catch (err) {
                        alert(err instanceof Error ? err.message : "Update failed");
                      } finally {
                        setBusy(false);
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      if (!confirm("Delete this score?")) return;
                      setBusy(true);
                      try {
                        await delScore({ data: { scoreId: s.id } });
                        await qc.invalidateQueries({ queryKey: ["concours-scores-admin", eventId] });
                        await qc.invalidateQueries({ queryKey: ["concours-vehicles-admin", eventId] });
                        await qc.invalidateQueries({ queryKey: ["concours-vehicles", eventId] });
                      } catch (err) {
                        alert(err instanceof Error ? err.message : "Delete failed");
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="rounded border-2 border-primary px-2 py-1 text-[10px] font-bold uppercase text-primary"
                  >
                    Del
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {adminTab === "results" && (
        <div className="space-y-3">
          <p className="text-xs text-ink/60">
            After the event: pick the winner, upload a showcase photo, and optionally pin it on the
            home page.
          </p>

          {ranked.length > 0 && (
            <div className="rounded-lg border-2 border-ink/20 bg-paper p-2 text-xs">
              <p className="font-bold uppercase text-primary">Live ranking</p>
              <ol className="mt-1 space-y-0.5">
                {ranked.slice(0, 5).map((v, i) => (
                  <li key={v.id}>
                    #{i + 1} {v.tagged_display_name || v.label || "Vehicle"} — {v.average_score} (
                    {v.submission_count} votes)
                  </li>
                ))}
              </ol>
            </div>
          )}

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-ink/70">
              Winner vehicle
            </span>
            <select
              value={winnerVehicleId}
              onChange={(e) => setWinnerVehicleId(e.target.value)}
              className={inp}
            >
              <option value="">— Select —</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {(v.tagged_display_name || v.label || "Vehicle") +
                    (v.average_score != null ? ` (${v.average_score})` : "")}
                </option>
              ))}
            </select>
          </label>

          <ImageUploadField
            label="Winner showcase photo (required for home)"
            value={winnerPhotoUrl}
            onChange={(v) => setWinnerPhotoUrl(v || "")}
            bucket="gallery"
            folder={`events/concours/${eventId}/winner`}
            maxMb={6}
          />

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-ink/70">
              Headline (EN)
            </span>
            <input
              value={winnerHeadlineEn}
              onChange={(e) => setWinnerHeadlineEn(e.target.value)}
              placeholder="e.g. Concours Mini champ — Stilbaai cruise"
              className={inp}
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-ink/70">
              Headline (AF)
            </span>
            <input
              value={winnerHeadlineAf}
              onChange={(e) => setWinnerHeadlineAf(e.target.value)}
              className={inp}
            />
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={resultsOnHome}
              onChange={(e) => setResultsOnHome(e.target.checked)}
            />
            <span className="text-sm font-bold">Show on home page</span>
          </label>

          <button
            type="button"
            disabled={busy || (resultsOnHome && !winnerPhotoUrl)}
            onClick={saveResults}
            className="inline-flex items-center gap-1 rounded-md border-2 border-ink bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-paper disabled:opacity-50"
          >
            <Trophy className="h-4 w-4" />
            {busy ? "Saving…" : resultsOnHome ? "Publish to home" : "Save results"}
          </button>
          {msg && <p className="text-sm font-bold text-primary">{msg}</p>}
        </div>
      )}
    </div>
  );
}

const inp = "mt-1 w-full rounded-md border-2 border-ink bg-paper px-3 py-2";
