import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { CharCounter } from "@/components/CharCounter";
import {
  adminAddPollOption,
  adminDeletePollOption,
  adminHidePollOption,
  adminListPolls,
  adminSetPollHome,
  adminSetPollStatus,
  adminUpsertPoll,
  type AdminPoll,
  type PollStatus,
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

      <div className="space-y-4 rounded-xl border-2 border-ink bg-card p-4 shadow-[4px_4px_0_0_var(--color-ink)]">
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
