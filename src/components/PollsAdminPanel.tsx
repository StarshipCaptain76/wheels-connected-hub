import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MapPin, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { CharCounter } from "@/components/CharCounter";
import { useI18n } from "@/i18n/I18nProvider";
import {
  adminAddPollOption,
  adminCombinedPollInsight,
  adminDeletePollOption,
  adminHidePollOption,
  adminListPolls,
  adminPollInsight,
  adminSetPollHome,
  adminSetPollStatus,
  adminUpsertPoll,
  type AdminPoll,
  type CombinedPollInsight,
  type OutingRoute,
  type PollInsight,
  type PollStatus,
  type SuggestedPoll,
} from "@/lib/polls.functions";

const inp = "mt-1 w-full rounded-md border-2 border-ink bg-paper px-3 py-2 text-sm";

type SeedRow = { labelEn: string; labelAf: string };
type FormState = {
  id?: string;
  titleEn: string;
  titleAf: string;
  questionEn: string;
  questionAf: string;
  allowMemberOptions: boolean;
  showOnHome: boolean;
  status: PollStatus;
  seeds: SeedRow[];
};

const emptyForm = (): FormState => ({
  titleEn: "",
  titleAf: "",
  questionEn: "",
  questionAf: "",
  allowMemberOptions: true,
  showOnHome: true,
  status: "open",
  seeds: [{ labelEn: "", labelAf: "" }, { labelEn: "", labelAf: "" }],
});

function fromPoll(p: AdminPoll): FormState {
  return {
    id: p.id,
    titleEn: p.title_en,
    titleAf: p.title_af ?? "",
    questionEn: p.question_en,
    questionAf: p.question_af ?? "",
    allowMemberOptions: p.allow_member_options,
    showOnHome: p.show_on_home,
    status: p.status,
    seeds: [],
  };
}

export function PollsAdminPanel() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["admin", "polls"], queryFn: () => adminListPolls() });
  const upsert = useServerFn(adminUpsertPoll);
  const setStatus = useServerFn(adminSetPollStatus);
  const setHome = useServerFn(adminSetPollHome);
  const addOpt = useServerFn(adminAddPollOption);
  const hideOpt = useServerFn(adminHidePollOption);
  const delOpt = useServerFn(adminDeletePollOption);

  const [form, setForm] = useState<FormState>(emptyForm());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [newEn, setNewEn] = useState("");
  const [newAf, setNewAf] = useState("");

  const polls = list.data ?? [];
  const editing = form.id ? polls.find((p) => p.id === form.id) : null;

  function load(p: AdminPoll) {
    setForm(fromPoll(p));
    setMsg(null);
    setNewEn("");
    setNewAf("");
  }

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["admin", "polls"] });
    await qc.invalidateQueries({ queryKey: ["home-polls"] });
  }

  async function save() {
    if (!form.questionEn.trim()) {
      setMsg("Question (EN) is required.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const row = await upsert({
        data: {
          id: form.id,
          titleEn: form.titleEn,
          titleAf: form.titleAf || null,
          questionEn: form.questionEn,
          questionAf: form.questionAf || null,
          allowMemberOptions: form.allowMemberOptions,
          showOnHome: form.status === "closed" ? false : form.showOnHome,
          status: form.status,
          seedOptions: form.id
            ? undefined
            : form.seeds
                .filter((s) => s.labelEn.trim())
                .map((s) => ({ labelEn: s.labelEn.trim(), labelAf: s.labelAf.trim() || null })),
        },
      });
      load(row);
      await refresh();
      setMsg("Saved");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function run(fn: () => Promise<AdminPoll>) {
    setBusy(true);
    setMsg(null);
    try {
      const row = await fn();
      if (form.id === row.id) load(row);
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-4xl tracking-wide text-ink">Polls</h1>
        <button
          type="button"
          onClick={() => {
            setForm(emptyForm());
            setMsg(null);
          }}
          className="inline-flex items-center gap-1 rounded-md border-2 border-ink bg-primary px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-paper"
        >
          <Plus className="h-3.5 w-3.5" /> New poll
        </button>
      </div>

      {msg && (
        <p className="rounded border-2 border-primary bg-primary/10 px-3 py-2 text-sm font-bold text-primary">
          {msg}
        </p>
      )}

      {polls.length > 0 && (
        <CombinedOutingCard
          voteHint={polls.reduce((s, p) => s + p.total_votes, 0)}
          onUsePoll={(draft) => {
            setForm(draft);
            setMsg(null);
            requestAnimationFrame(() =>
              document.getElementById("new-poll-form")?.scrollIntoView({ behavior: "smooth", block: "start" }),
            );
          }}
        />
      )}

      <div className="overflow-x-auto rounded-lg border-2 border-ink">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-black text-white">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-bold uppercase">Status</th>
              <th className="px-3 py-2 text-left text-xs font-bold uppercase">Poll</th>
              <th className="px-3 py-2 text-left text-xs font-bold uppercase">Home</th>
              <th className="px-3 py-2 text-left text-xs font-bold uppercase">Votes</th>
              <th className="px-3 py-2 text-left text-xs font-bold uppercase"> </th>
            </tr>
          </thead>
          <tbody>
            {polls.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-ink/50">
                  No polls yet.
                </td>
              </tr>
            )}
            {polls.map((p) => (
              <tr key={p.id} className="border-t border-ink/10 bg-paper">
                <td className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-primary">
                  {p.status}
                </td>
                <td className="px-3 py-2">
                  <div className="font-semibold">{p.title_en || p.question_en}</div>
                  <div className="text-xs text-ink/60">{p.question_en}</div>
                </td>
                <td className="px-3 py-2 text-xs">{p.show_on_home ? "Yes" : "—"}</td>
                <td className="px-3 py-2 tabular-nums">{p.total_votes}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => load(p)}
                      className="inline-flex items-center gap-1 rounded border-2 border-ink bg-paper px-2 py-1 text-[10px] font-bold uppercase"
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                    {p.status !== "open" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void run(() => setStatus({ data: { id: p.id, status: "open" } }))}
                        className="rounded border-2 border-ink bg-paper px-2 py-1 text-[10px] font-bold uppercase"
                      >
                        Open
                      </button>
                    )}
                    {p.status === "open" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void run(() => setStatus({ data: { id: p.id, status: "closed" } }))}
                        className="rounded border-2 border-ink bg-paper px-2 py-1 text-[10px] font-bold uppercase"
                      >
                        Close
                      </button>
                    )}
                    {p.status === "open" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void run(() => setHome({ data: { id: p.id, showOnHome: !p.show_on_home } }))
                        }
                        className="rounded border-2 border-ink bg-paper px-2 py-1 text-[10px] font-bold uppercase"
                      >
                        {p.show_on_home ? "Off home" : "On home"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        id="new-poll-form"
        className="scroll-mt-20 space-y-4 rounded-xl border-2 border-ink bg-card p-4 shadow-[4px_4px_0_0_var(--color-ink)]"
      >
        <h2 className="font-display text-2xl text-ink">{form.id ? "Edit poll" : "New poll"}</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-ink/70">Title (EN)</span>
            <input
              value={form.titleEn}
              maxLength={120}
              onChange={(e) => setForm({ ...form, titleEn: e.target.value })}
              className={inp}
            />
            <CharCounter value={form.titleEn} max={120} />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-ink/70">Title (AF)</span>
            <input
              value={form.titleAf}
              maxLength={120}
              onChange={(e) => setForm({ ...form, titleAf: e.target.value })}
              className={inp}
            />
            <CharCounter value={form.titleAf} max={120} />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-ink/70">Question (EN)</span>
            <input
              value={form.questionEn}
              maxLength={240}
              onChange={(e) => setForm({ ...form, questionEn: e.target.value })}
              className={inp}
            />
            <CharCounter value={form.questionEn} max={240} />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-ink/70">Question (AF)</span>
            <input
              value={form.questionAf}
              maxLength={240}
              onChange={(e) => setForm({ ...form, questionAf: e.target.value })}
              className={inp}
            />
            <CharCounter value={form.questionAf} max={240} />
          </label>
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.allowMemberOptions}
            onChange={(e) => setForm({ ...form, allowMemberOptions: e.target.checked })}
          />
          <span className="text-sm font-bold">Members may add one option</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.showOnHome}
            disabled={form.status === "closed"}
            onChange={(e) => setForm({ ...form, showOnHome: e.target.checked })}
          />
          <span className="text-sm font-bold">Show on homepage (open polls only, max 3)</span>
        </label>
        <label className="block max-w-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-ink/70">Status</span>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as PollStatus })}
            className={inp}
          >
            <option value="draft">draft</option>
            <option value="open">open</option>
            <option value="closed">closed</option>
          </select>
        </label>

        {!form.id && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-ink/70">Seed options</p>
            <div className="mt-2 space-y-2">
              {form.seeds.map((s, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-2">
                  <input
                    placeholder="EN"
                    maxLength={80}
                    value={s.labelEn}
                    onChange={(e) => {
                      const seeds = [...form.seeds];
                      seeds[i] = { ...seeds[i], labelEn: e.target.value };
                      setForm({ ...form, seeds });
                    }}
                    className={inp}
                  />
                  <input
                    placeholder="AF"
                    maxLength={80}
                    value={s.labelAf}
                    onChange={(e) => {
                      const seeds = [...form.seeds];
                      seeds[i] = { ...seeds[i], labelAf: e.target.value };
                      setForm({ ...form, seeds });
                    }}
                    className={inp}
                  />
                </div>
              ))}
            </div>
            {form.seeds.length < 20 && (
              <button
                type="button"
                onClick={() => setForm({ ...form, seeds: [...form.seeds, { labelEn: "", labelAf: "" }] })}
                className="mt-2 text-xs font-bold uppercase tracking-wider text-primary"
              >
                + Add seed row
              </button>
            )}
          </div>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="rounded-md border-2 border-ink bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-paper disabled:opacity-50"
        >
          {busy ? "Saving…" : form.id ? "Save" : "Create poll"}
        </button>

        {editing && (
          <>
            <PollSummaryCard pollId={editing.id} totalVotes={editing.total_votes} />
            <h3 className="font-display text-xl text-ink">Results</h3>
            <div className="overflow-x-auto rounded-lg border-2 border-ink">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-black text-white">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-bold uppercase">Option</th>
                    <th className="px-3 py-2 text-left text-xs font-bold uppercase">Count</th>
                    <th className="px-3 py-2 text-left text-xs font-bold uppercase">%</th>
                    <th className="px-3 py-2 text-left text-xs font-bold uppercase">Source</th>
                    <th className="px-3 py-2 text-left text-xs font-bold uppercase">Added by</th>
                    <th className="px-3 py-2 text-left text-xs font-bold uppercase"> </th>
                  </tr>
                </thead>
                <tbody>
                  {editing.options.map((o) => {
                    const pct =
                      editing.total_votes === 0
                        ? 0
                        : Math.round((o.vote_count / editing.total_votes) * 100);
                    return (
                      <tr
                        key={o.id}
                        className={`border-t border-ink/10 ${o.hidden ? "bg-ink/5 text-ink/50" : "bg-paper"}`}
                      >
                        <td className="px-3 py-2">
                          {o.label_en}
                          {o.label_af && o.label_af !== o.label_en ? (
                            <span className="block text-xs text-ink/50">{o.label_af}</span>
                          ) : null}
                          {o.hidden ? (
                            <span className="ml-1 text-[10px] font-bold uppercase">Hidden</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 tabular-nums">{o.vote_count}</td>
                        <td className="px-3 py-2 tabular-nums">{pct}%</td>
                        <td className="px-3 py-2 text-xs uppercase">{o.source}</td>
                        <td className="px-3 py-2 text-xs">{o.added_by_name ?? "—"}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void run(() => hideOpt({ data: { optionId: o.id, hidden: !o.hidden } }))
                              }
                              className="rounded border-2 border-ink bg-paper px-2 py-1 text-[10px] font-bold uppercase"
                            >
                              {o.hidden ? "Show" : "Hide"}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void run(() => delOpt({ data: { optionId: o.id } }))}
                              className="inline-flex items-center gap-1 rounded border-2 border-ink bg-paper px-2 py-1 text-[10px] font-bold uppercase"
                            >
                              <Trash2 className="h-3 w-3" /> Del
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {editing.options.filter((o) => !o.hidden).length < 20 && (
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <input
                  value={newEn}
                  maxLength={80}
                  placeholder="New option (EN)"
                  onChange={(e) => setNewEn(e.target.value)}
                  className={inp}
                />
                <input
                  value={newAf}
                  maxLength={80}
                  placeholder="New option (AF)"
                  onChange={(e) => setNewAf(e.target.value)}
                  className={inp}
                />
                <button
                  type="button"
                  disabled={busy || !newEn.trim()}
                  onClick={() =>
                    void run(async () => {
                      const row = await addOpt({
                        data: { pollId: editing.id, labelEn: newEn.trim(), labelAf: newAf.trim() || null },
                      });
                      setNewEn("");
                      setNewAf("");
                      return row;
                    })
                  }
                  className="mt-1 rounded-md border-2 border-ink bg-paper px-3 py-2 text-xs font-bold uppercase tracking-wider disabled:opacity-50"
                >
                  Add option
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function mapsUrl(route: OutingRoute): string {
  const tag = (p: string) => `${p}, Western Cape, South Africa`;
  const origin = encodeURIComponent(tag(route.start));
  const destination = encodeURIComponent(tag(route.destination));
  const waypoints = route.stops.map((s) => encodeURIComponent(tag(s))).join("%7C");
  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
  if (waypoints) url += `&waypoints=${waypoints}`;
  return url;
}

function CombinedOutingCard({
  voteHint,
  onUsePoll,
}: {
  voteHint: number;
  onUsePoll: (draft: FormState) => void;
}) {
  const { lang } = useI18n();
  const insightFn = useServerFn(adminCombinedPollInsight);
  const [data, setData] = useState<CombinedPollInsight | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setErr(null);
    try {
      setData(await insightFn({}));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load combined insight");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voteHint]);

  const af = lang === "af";
  const suggestion = af && data?.suggestion_af ? data.suggestion_af : data?.suggestion_en;
  const route = data?.route ?? null;
  const routeTitle = route ? (af && route.title_af ? route.title_af : route.title_en) : null;
  const distance = route ? (af && route.distance_af ? route.distance_af : route.distance_en) : null;
  const why = route ? (af && route.why_af ? route.why_af : route.why_en) : null;

  return (
    <div className="rounded-xl border-2 border-ink bg-paper p-4 shadow-[4px_4px_0_0_var(--color-ink)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
            {af ? "Alle peilings" : "All polls"}
          </p>
          <p className="mt-1 font-display text-4xl leading-none text-ink">
            {data?.total_votes ?? voteHint}
            <span className="ml-2 font-sans text-sm font-semibold text-ink/55">
              {af ? "stemme" : "votes"}
            </span>
          </p>
          <p className="mt-1 text-xs text-ink/60">
            {data?.open_polls ?? 0} {af ? "oop" : "open"}
            {typeof data?.on_home === "number" ? ` · ${data.on_home} ${af ? "op tuis" : "on home"}` : ""}
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void load()}
          className="inline-flex items-center gap-1 rounded-md border-2 border-ink bg-paper px-2 py-1 text-[10px] font-bold uppercase tracking-wider disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 text-primary" />}
          {busy ? (af ? "Dink…" : "Thinking…") : af ? "Verfris" : "Refresh"}
        </button>
      </div>

      {data && data.polls.length > 0 && (
        <div className="mt-4 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink/45">
            {af ? "Lopende opsomming" : "Running summary"}
          </p>
          {data.polls.map((p) => {
            const max = Math.max(1, ...p.overall.map((o) => o.vote_count));
            return (
              <div key={p.id} className="border-t border-ink/10 pt-2">
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <span className="min-w-0 font-semibold">{p.question_en}</span>
                  <span className="text-ink/60">
                    {p.total_votes} {af ? "stemme" : "votes"}
                    {p.leader ? ` · ${p.leader}` : ""}
                  </span>
                </div>
                {p.recent_leader && p.recent_leader !== p.leader && (
                  <p className="text-[11px] text-ink/55">
                    {af ? "Onlangse stemme" : "Recent votes"}: {p.recent_leader}
                  </p>
                )}
                <ul className="mt-1 space-y-0.5">
                  {p.overall.slice(0, 6).map((o) => (
                    <li key={o.label_en}>
                      <div className="flex justify-between text-[11px]">
                        <span>{o.label_en}</span>
                        <span className="tabular-nums text-ink/60">
                          {o.vote_count} · {o.pct}%
                        </span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-ink/10">
                        <div className="h-full bg-primary" style={{ width: `${Math.round((o.vote_count / max) * 100)}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 rounded-md border-2 border-primary/40 bg-primary/5 px-3 py-2">
        <p className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary">
          <Sparkles className="h-3 w-3" /> {af ? "AI-ontleding" : "AI analysis"}
        </p>
        {busy && !suggestion ? (
          <p className="mt-1 text-sm text-ink/50">{af ? "Lees al die stemme…" : "Reading all the votes…"}</p>
        ) : suggestion ? (
          <p className="mt-1 text-sm leading-relaxed text-ink">{suggestion}</p>
        ) : (
          <p className="mt-1 text-sm text-ink/60">{data?.ai_note || err || (af ? "Nog geen voorstel." : "No suggestion yet.")}</p>
        )}
      </div>

      {route && (
        <div className="mt-3 rounded-md border-2 border-ink bg-card px-3 py-3">
          <p className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary">
            <MapPin className="h-3 w-3" /> {af ? "Voorgestelde roete" : "Proposed route"}
          </p>
          {routeTitle && <p className="mt-1 font-display text-2xl leading-tight text-ink">{routeTitle}</p>}
          <ol className="mt-2 space-y-1 text-sm">
            <li>
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink/45">{af ? "Begin" : "Start"} </span>
              {route.start}
            </li>
            {route.stops.map((s, i) => (
              <li key={`${s}-${i}`}>
                <span className="text-[10px] font-bold uppercase tracking-wider text-ink/45">
                  {af ? "Stop" : "Stop"} {i + 1}{" "}
                </span>
                {s}
              </li>
            ))}
            <li>
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink/45">
                {af ? "Bestemming" : "Destination"}{" "}
              </span>
              {route.destination}
            </li>
          </ol>
          {distance && <p className="mt-2 text-sm font-semibold text-ink">{distance}</p>}
          {why && <p className="mt-1 text-sm leading-relaxed text-ink/75">{why}</p>}
          <a
            href={mapsUrl(route)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 rounded-md border-2 border-ink bg-primary px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-paper"
          >
            <MapPin className="h-3.5 w-3.5" />
            {af ? "Maak oop in Maps" : "Open in Maps"}
          </a>
        </div>
      )}

      {data && data.new_polls.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink/45">
            {af ? "Voorgestelde nuwe peilings" : "Suggested next polls"}
          </p>
          {data.new_polls.map((np, i) => (
            <SuggestedPollRow key={`${np.question_en}-${i}`} poll={np} af={af} onUse={onUsePoll} />
          ))}
        </div>
      )}
    </div>
  );
}

function SuggestedPollRow({
  poll,
  af,
  onUse,
}: {
  poll: SuggestedPoll;
  af: boolean;
  onUse: (draft: FormState) => void;
}) {
  const question = af && poll.question_af ? poll.question_af : poll.question_en;
  const why = af && poll.why_af ? poll.why_af : poll.why_en;
  const seeds =
    poll.options.length > 0
      ? poll.options.map((o) => ({ labelEn: o.en, labelAf: o.af }))
      : emptyForm().seeds;

  return (
    <div className="rounded-md border-2 border-ink/20 bg-card px-3 py-2">
      <p className="font-semibold text-ink">{question}</p>
      {why ? <p className="mt-0.5 text-xs leading-relaxed text-ink/65">{why}</p> : null}
      {poll.options.length > 0 && (
        <p className="mt-1 text-[11px] text-ink/50">{poll.options.map((o) => (af && o.af ? o.af : o.en)).join(" · ")}</p>
      )}
      <button
        type="button"
        onClick={() =>
          onUse({
            titleEn: poll.title_en,
            titleAf: poll.title_af,
            questionEn: poll.question_en,
            questionAf: poll.question_af,
            allowMemberOptions: true,
            showOnHome: true,
            status: "open",
            seeds,
          })
        }
        className="mt-2 inline-flex items-center gap-1 rounded-md border-2 border-ink bg-paper px-2 py-1 text-[10px] font-bold uppercase tracking-wider"
      >
        <Plus className="h-3 w-3" /> {af ? "Begin hierdie peiling" : "Start this poll"}
      </button>
    </div>
  );
}

function PollSummaryCard({ pollId, totalVotes }: { pollId: string; totalVotes: number }) {
  const { lang } = useI18n();
  const insightFn = useServerFn(adminPollInsight);
  const [data, setData] = useState<PollInsight | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setErr(null);
    try {
      setData(await insightFn({ data: { pollId } }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load insight");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollId, totalVotes]);

  const max = Math.max(1, ...(data?.overall.map((o) => o.vote_count) ?? [1]));
  const suggestion =
    lang === "af" && data?.suggestion_af ? data.suggestion_af : data?.suggestion_en;

  return (
    <div className="rounded-xl border-2 border-ink bg-paper p-4 shadow-[4px_4px_0_0_var(--color-ink)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Vote summary</p>
          <p className="mt-1 font-display text-4xl leading-none text-ink">
            {data?.total_votes ?? totalVotes}
            <span className="ml-2 font-sans text-sm font-semibold text-ink/55">votes</span>
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void load()}
          className="inline-flex items-center gap-1 rounded-md border-2 border-ink bg-paper px-2 py-1 text-[10px] font-bold uppercase tracking-wider disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 text-primary" />}
          {busy ? "Thinking…" : "Refresh"}
        </button>
      </div>

      {data?.leader && (
        <p className="mt-2 text-sm text-ink">
          <span className="font-bold">Overall lead:</span> {data.leader.label_en}{" "}
          <span className="text-ink/60">
            ({data.leader.vote_count} · {data.leader.pct}%)
          </span>
        </p>
      )}
      {data?.recent_leader && (
        <p className="text-sm text-ink">
          <span className="font-bold">Recent votes:</span> {data.recent_leader.label_en}{" "}
          <span className="text-ink/60">
            ({data.recent_leader.count} of last {data.recent.length})
          </span>
        </p>
      )}

      {data && data.overall.length > 0 && (
        <ul className="mt-3 space-y-1">
          {data.overall.map((o) => (
            <li key={o.id}>
              <div className="flex justify-between text-[11px] font-semibold">
                <span>{o.label_en}</span>
                <span className="tabular-nums">
                  {o.vote_count} · {o.pct}%
                </span>
              </div>
              <div className="mt-0.5 h-1.5 overflow-hidden rounded-full border border-ink/20 bg-ink/5">
                <div className="h-full bg-primary" style={{ width: `${Math.round((o.vote_count / max) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {data && data.recent.length > 0 && (
        <p className="mt-3 text-[11px] leading-relaxed text-ink/70">
          <span className="font-bold uppercase tracking-wider text-ink/50">Latest: </span>
          {data.recent
            .slice()
            .reverse()
            .map((r) => r.label_en)
            .join(" → ")}
        </p>
      )}

      <div className="mt-3 rounded-md border-2 border-primary/40 bg-primary/5 px-3 py-2">
        <p className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary">
          <Sparkles className="h-3 w-3" /> Suggestion
        </p>
        {busy && !suggestion ? (
          <p className="mt-1 text-sm text-ink/50">Reading the votes…</p>
        ) : suggestion ? (
          <p className="mt-1 text-sm leading-relaxed text-ink">{suggestion}</p>
        ) : (
          <p className="mt-1 text-sm text-ink/60">{data?.ai_note || err || "No suggestion yet."}</p>
        )}
      </div>
    </div>
  );
}
