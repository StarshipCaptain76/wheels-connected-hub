import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { SiteLayout } from "@/components/SiteLayout";
import {
  listAllConcoursQuestionsAdmin,
  upsertConcoursQuestion,
  type ConcoursQuestion,
} from "@/lib/concours.functions";
import { Plus, Pencil, Trophy, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/concours")({
  head: () => ({
    meta: [
      { title: "Concours Questions — Just Wheels" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminConcoursQuestions,
  errorComponent: ({ error }) => (
    <SiteLayout>
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="text-ink/70">Access denied: {error.message}</p>
        <Link to="/members" className="mt-4 inline-block text-primary underline">
          Back to garage
        </Link>
      </div>
    </SiteLayout>
  ),
});

const inp =
  "mt-1 w-full rounded-md border-2 border-ink bg-paper px-3 py-2 text-sm font-normal normal-case";

const SCORING = [
  { value: "scale_1_10", label: "1–10 scale" },
  { value: "yes_no", label: "Yes / No" },
  { value: "yes_no_na", label: "Yes / No / N/A" },
  { value: "count", label: "Count (number)" },
] as const;

type Draft = Omit<Partial<ConcoursQuestion>, "scoring_type"> & { scoring_type?: string };

function AdminConcoursQuestions() {
  const qc = useQueryClient();
  const upsertQ = useServerFn(upsertConcoursQuestion);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(true);

  const questionsQ = useQuery({
    queryKey: ["concours-questions-admin"],
    queryFn: () => listAllConcoursQuestionsAdmin(),
  });

  const all = useMemo(() => questionsQ.data ?? [], [questionsQ.data]);
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return all.filter((q) => {
      if (!showInactive && q.active === false) return false;
      if (!s) return true;
      return (
        q.text_en.toLowerCase().includes(s) ||
        (q.text_af ?? "").toLowerCase().includes(s) ||
        q.category.toLowerCase().includes(s)
      );
    });
  }, [all, search, showInactive]);

  const activeCount = all.filter((q) => q.active !== false).length;
  const categories = Array.from(new Set(all.map((q) => q.category))).sort();
  const catAfMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const q of all) if (q.category_af && !m[q.category]) m[q.category] = q.category_af;
    return m;
  }, [all]);


  async function save() {
    if (!draft) return;
    if (!draft.category?.trim() || !draft.text_en?.trim() || !draft.text_af?.trim()) {
      toast.error("Category and both question languages are required");
      return;
    }
    setBusy(true);
    try {
      await upsertQ({
        data: {
          id: draft.id ?? null,
          category: draft.category.trim(),
          categoryAf: draft.category_af?.trim() || null,
          textEn: draft.text_en.trim(),
          textAf: draft.text_af.trim(),
          scoringType:
            (draft.scoring_type as "scale_1_10" | "yes_no" | "yes_no_na" | "count") ??
            "scale_1_10",
          sortOrder: draft.sort_order ?? all.length + 1,
          active: draft.active !== false,
        },
      });
      setDraft(null);
      await qc.invalidateQueries({ queryKey: ["concours-questions-admin"] });
      toast.success("Question saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(q: ConcoursQuestion) {
    setBusy(true);
    try {
      await upsertQ({
        data: {
          id: q.id,
          category: q.category,
          categoryAf: q.category_af,
          textEn: q.text_en,
          textAf: q.text_af,
          scoringType: q.scoring_type,
          sortOrder: q.sort_order,
          active: q.active === false,
        },
      });
      await qc.invalidateQueries({ queryKey: ["concours-questions-admin"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            <p className="font-display text-xs tracking-[0.3em] text-primary">CONCOURS</p>
          </div>
          <h1 className="font-display text-4xl tracking-wide text-ink">Question editor</h1>
          <p className="mt-1 text-sm text-ink/60">
            Master question bank. Events roll a balanced set from the active questions.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            setDraft({
              category: categories[0] ?? "Quirks & Character",
              text_en: "",
              text_af: "",
              scoring_type: "scale_1_10",
              sort_order: all.length + 1,
              active: true,
            })
          }
          className="inline-flex min-h-10 items-center gap-2 rounded-md border-2 border-ink bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-paper shadow-[3px_3px_0_0_var(--color-ink)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"
        >
          <Plus className="h-4 w-4" /> Add question
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search questions or categories…"
            className="w-full rounded-md border-2 border-ink bg-paper py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink/70">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Show inactive
        </label>
        <p className="text-xs text-ink/60">
          {activeCount} active · {all.length} total
        </p>
      </div>

      {draft && (
        <div className="mt-4 space-y-3 rounded-2xl border-2 border-primary bg-primary/5 p-4">
          <p className="font-display text-lg tracking-wide text-ink">
            {draft.id ? "Edit question" : "New question"}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
              Category (EN)
              <select
                value={
                  draft.category && categories.includes(draft.category) ? draft.category : "__new"
                }
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "__new") {
                    setDraft({ ...draft, category: "", category_af: "" });
                  } else {
                    setDraft({ ...draft, category: v, category_af: catAfMap[v] ?? draft.category_af ?? "" });
                  }
                }}
                className={inp}
              >
                {categories.length === 0 && <option value="__new">No categories yet</option>}
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value="__new">+ New category…</option>
              </select>
              {!(draft.category && categories.includes(draft.category)) && (
                <input
                  value={draft.category ?? ""}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                  placeholder="New category name"
                  className={inp}
                />
              )}
            </label>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
              Category (AF)
              <input
                value={draft.category_af ?? ""}
                onChange={(e) => setDraft({ ...draft, category_af: e.target.value })}
                className={inp}
              />
            </label>

            <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
              Question (EN)
              <textarea
                rows={2}
                value={draft.text_en ?? ""}
                onChange={(e) => setDraft({ ...draft, text_en: e.target.value })}
                className={inp}
              />
            </label>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
              Question (AF)
              <textarea
                rows={2}
                value={draft.text_af ?? ""}
                onChange={(e) => setDraft({ ...draft, text_af: e.target.value })}
                className={inp}
              />
            </label>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
              Scoring
              <select
                value={draft.scoring_type ?? "scale_1_10"}
                onChange={(e) => setDraft({ ...draft, scoring_type: e.target.value })}
                className={inp}
              >
                {SCORING.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
              Sort order
              <input
                type="number"
                value={draft.sort_order ?? 0}
                onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })}
                className={inp}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={save}
              className="min-h-10 rounded-md border-2 border-ink bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-paper disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save question"}
            </button>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="min-h-10 rounded-md border-2 border-ink bg-paper px-4 py-2 text-sm font-bold uppercase tracking-wider text-ink hover:bg-ink/5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {questionsQ.isLoading ? (
        <p className="mt-6 text-sm text-ink/60">Loading questions…</p>
      ) : filtered.length === 0 ? (
        <p className="mt-6 text-sm text-ink/60">No questions match.</p>
      ) : (
        <ul className="mt-5 space-y-2">
          {filtered.map((q) => (
            <li
              key={q.id}
              className={`flex items-start justify-between gap-3 rounded-xl border-2 border-ink bg-paper p-3 ${
                q.active === false ? "opacity-55" : ""
              }`}
            >
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                  {q.category} · {q.scoring_type} · #{q.sort_order}
                  {q.active === false ? " · inactive" : ""}
                </p>
                <p className="font-bold text-ink">{q.text_en}</p>
                <p className="text-xs text-ink/60">{q.text_af}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setDraft(q)}
                  title="Edit"
                  className="rounded-md border-2 border-ink p-2 hover:bg-ink/5"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => toggleActive(q)}
                  className="rounded-md border-2 border-primary px-2 py-1.5 text-[10px] font-bold uppercase text-primary disabled:opacity-50"
                >
                  {q.active === false ? "On" : "Off"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
