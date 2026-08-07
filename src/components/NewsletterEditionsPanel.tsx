import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Sparkles, Send, Upload, Trash2, Eye, Save } from "lucide-react";
import {
  listEditions,
  saveEdition,
  deleteEdition,
  draftEdition,
  sendEdition,
  type NewsletterEdition,
} from "@/lib/newsletter-editions.functions";
import { useConfirm } from "@/components/ConfirmDialog";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type Draft = {
  id?: string;
  year: number;
  month: number;
  titleEn: string;
  titleAf: string;
  bodyEn: string;
  bodyAf: string;
  adminNotes: string;
  isPublished: boolean;
  pdfPath: string | null;
};

function emptyDraft(): Draft {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    titleEn: "",
    titleAf: "",
    bodyEn: "",
    bodyAf: "",
    adminNotes: "",
    isPublished: false,
    pdfPath: null,
  };
}

function toDraft(e: NewsletterEdition): Draft {
  return {
    id: e.id,
    year: e.year,
    month: e.month,
    titleEn: e.title_en,
    titleAf: e.title_af,
    bodyEn: e.body_en,
    bodyAf: e.body_af,
    adminNotes: e.admin_notes ?? "",
    isPublished: e.is_published,
    pdfPath: e.pdf_path,
  };
}

async function fileToBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 8192) {
    bin += String.fromCharCode(...buf.subarray(i, i + 8192));
  }
  return btoa(bin);
}

const btn =
  "inline-flex items-center gap-2 rounded-md border-2 border-ink px-4 py-2 text-sm font-bold uppercase tracking-wider shadow-[3px_3px_0_0_var(--color-ink)] transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none disabled:opacity-50";

export function NewsletterEditionsPanel() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { data: editions = [] } = useQuery({
    queryKey: ["newsletter-editions", "admin"],
    queryFn: () => listEditions(),
  });

  const saveFn = useServerFn(saveEdition);
  const delFn = useServerFn(deleteEdition);
  const draftFn = useServerFn(draftEdition);
  const sendFn = useServerFn(sendEdition);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<null | string>(null);
  const [status, setStatus] = useState<string | null>(null);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((d) => (d ? { ...d, [k]: v } : d));

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["newsletter-editions"] });
  }

  async function persist(silent = false): Promise<string | null> {
    if (!draft) return null;
    const pdfBase64 = pdfFile ? await fileToBase64(pdfFile) : undefined;
    const res = await saveFn({
      data: {
        ...(draft.id ? { id: draft.id } : {}),
        year: draft.year,
        month: draft.month,
        titleEn: draft.titleEn,
        titleAf: draft.titleAf,
        bodyEn: draft.bodyEn,
        bodyAf: draft.bodyAf,
        adminNotes: draft.adminNotes,
        isPublished: draft.isPublished,
        ...(pdfBase64 ? { pdfBase64, pdfName: pdfFile!.name } : {}),
      },
    });
    setPdfFile(null);
    setDraft((d) => (d ? { ...d, id: res.id, pdfPath: pdfBase64 ? "uploaded" : d.pdfPath } : d));
    await refresh();
    if (!silent) setStatus("Saved.");
    return res.id;
  }

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setStatus(null);
    try {
      await fn();
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-lg border-2 border-ink bg-card p-5 shadow-[4px_4px_0_0_var(--color-primary)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-2xl tracking-wide">
          <FileText className="h-5 w-5 text-primary" /> Monthly newsletter editions
        </h2>
        <button
          type="button"
          className={`${btn} bg-primary text-paper`}
          onClick={() => {
            setDraft(emptyDraft());
            setPdfFile(null);
            setStatus(null);
          }}
        >
          New edition
        </button>
      </div>

      {/* List */}
      <div className="mt-4 overflow-hidden rounded-lg border-2 border-ink">
        <table className="w-full text-sm">
          <thead className="bg-ink text-paper">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider">Edition</th>
              <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider">Subject</th>
              <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider">PDF</th>
              <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {editions.map((e) => (
              <tr key={e.id} className="border-t border-ink/10 bg-paper">
                <td className="px-3 py-2 font-bold">{MONTHS[e.month - 1]} {e.year}</td>
                <td className="px-3 py-2 text-ink/70">{e.title_en || "—"}</td>
                <td className="px-3 py-2">
                  {e.pdf_path ? (
                    e.is_published ? (
                      <a
                        className="inline-flex items-center gap-1 text-primary underline"
                        href={`/api/public/newsletter-pdf?id=${e.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Eye className="h-3.5 w-3.5" /> view
                      </a>
                    ) : (
                      <span className="text-ink/50">uploaded</span>
                    )
                  ) : (
                    <span className="text-ink/40">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span className="rounded bg-ink/10 px-2 py-0.5 text-xs">{e.status}</span>
                  {e.is_published && (
                    <span className="ml-1 rounded bg-primary/15 px-2 py-0.5 text-xs text-primary">
                      on home
                    </span>
                  )}
                  {e.sent_count > 0 && (
                    <span className="ml-1 text-xs text-ink/50">{e.sent_count} sent</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    className="mr-2 text-xs font-bold uppercase text-primary"
                    onClick={() => {
                      setDraft(toDraft(e));
                      setPdfFile(null);
                      setStatus(null);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="text-xs font-bold uppercase text-ink/50"
                    onClick={async () => {
                      const ok = await confirm({
                        title: `Delete ${MONTHS[e.month - 1]} ${e.year} edition?`,
                        description: "This cannot be undone.",
                        confirmLabel: "Delete",
                        destructive: true,
                      });
                      if (!ok) return;
                      await run("del", async () => {
                        await delFn({ data: { id: e.id } });
                        if (draft?.id === e.id) setDraft(null);
                        await refresh();
                      });
                    }}
                  >
                    <Trash2 className="inline h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {editions.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-ink/50">
                  No editions yet — start with July 2026.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Editor */}
      {draft && (
        <div className="mt-6 rounded-lg border-2 border-ink bg-paper p-4">
          <div className="flex flex-wrap gap-3">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-ink/60">Month</span>
              <select
                className="mt-1 block rounded-md border-2 border-ink bg-paper px-3 py-2 text-sm"
                value={draft.month}
                onChange={(ev) => set("month", Number(ev.target.value))}
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-ink/60">Year</span>
              <input
                type="number"
                className="mt-1 block w-28 rounded-md border-2 border-ink bg-paper px-3 py-2 text-sm"
                value={draft.year}
                onChange={(ev) => set("year", Number(ev.target.value))}
              />
            </label>
            <label className="flex items-end gap-2 pb-2">
              <input
                type="checkbox"
                checked={draft.isPublished}
                onChange={(ev) => set("isPublished", ev.target.checked)}
              />
              <span className="text-sm">Show on home page</span>
            </label>
          </div>

          <label className="mt-4 block">
            <span className="text-xs font-bold uppercase tracking-wider text-ink/60">
              Newsletter PDF
            </span>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <input
                type="file"
                accept="application/pdf"
                onChange={(ev) => setPdfFile(ev.target.files?.[0] ?? null)}
                className="text-sm"
              />
              {pdfFile && <span className="text-xs text-ink/60">{pdfFile.name}</span>}
              {!pdfFile && draft.pdfPath && (
                <span className="inline-flex items-center gap-1 text-xs text-ink/60">
                  <Upload className="h-3.5 w-3.5" /> PDF already uploaded
                </span>
              )}
            </div>
          </label>

          <label className="mt-4 block">
            <span className="text-xs font-bold uppercase tracking-wider text-ink/60">
              Extra content, context or instructions for the AI (optional)
            </span>
            <textarea
              rows={4}
              className="mt-1 w-full rounded-md border-2 border-ink bg-paper px-3 py-2 text-sm"
              value={draft.adminNotes}
              onChange={(ev) => set("adminNotes", ev.target.value)}
              placeholder="Mention the Stilbaai breakfast run, thank Hugo for the braai, keep it short…"
            />
          </label>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy !== null}
              className={`${btn} bg-paper text-ink`}
              onClick={() => run("save", async () => { await persist(); })}
            >
              <Save className="h-4 w-4" /> Save
            </button>
            <button
              type="button"
              disabled={busy !== null || (!pdfFile && !draft.pdfPath)}
              className={`${btn} bg-primary text-paper`}
              onClick={() =>
                run("ai", async () => {
                  const id = await persist(true);
                  if (!id) return;
                  const res = await draftFn({ data: { id } });
                  setDraft((d) =>
                    d
                      ? {
                          ...d,
                          titleEn: res.titleEn || d.titleEn,
                          titleAf: res.titleAf || d.titleAf,
                          bodyEn: res.bodyEn || d.bodyEn,
                          bodyAf: res.bodyAf || d.bodyAf,
                        }
                      : d,
                  );
                  setStatus("Draft written — review it, then save and send.");
                })
              }
            >
              <Sparkles className="h-4 w-4" />
              {busy === "ai" ? "Writing…" : "Write email with AI"}
            </button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-ink/60">Subject (EN)</span>
                <input
                  className="mt-1 w-full rounded-md border-2 border-ink bg-paper px-3 py-2 text-sm"
                  value={draft.titleEn}
                  onChange={(ev) => set("titleEn", ev.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-ink/60">Body (EN — HTML)</span>
                <textarea
                  rows={12}
                  className="mt-1 w-full rounded-md border-2 border-ink bg-paper px-3 py-2 font-mono text-xs"
                  value={draft.bodyEn}
                  onChange={(ev) => set("bodyEn", ev.target.value)}
                />
              </label>
            </div>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-ink/60">Subject (AF)</span>
                <input
                  className="mt-1 w-full rounded-md border-2 border-ink bg-paper px-3 py-2 text-sm"
                  value={draft.titleAf}
                  onChange={(ev) => set("titleAf", ev.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-ink/60">Body (AF — HTML)</span>
                <textarea
                  rows={12}
                  className="mt-1 w-full rounded-md border-2 border-ink bg-paper px-3 py-2 font-mono text-xs"
                  value={draft.bodyAf}
                  onChange={(ev) => set("bodyAf", ev.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy !== null || !draft.bodyEn}
              className={`${btn} bg-paper text-ink`}
              onClick={() =>
                run("test", async () => {
                  const id = await persist(true);
                  if (!id) return;
                  await sendFn({ data: { id, testOnly: true } });
                  setStatus("Test sent to admin@justwheels.co.za.");
                })
              }
            >
              <Send className="h-4 w-4" /> Send test to admin
            </button>
            <button
              type="button"
              disabled={busy !== null || !draft.bodyEn}
              className={`${btn} bg-primary text-paper`}
              onClick={async () => {
                const ok = await confirm({
                  title: "Send this edition to all subscribers?",
                  description: "The email and PDF go out immediately and cannot be recalled.",
                  confirmLabel: "Send now",
                  destructive: false,
                });
                if (!ok) return;
                await run("send", async () => {
                  const id = await persist(true);
                  if (!id) return;
                  const res = await sendFn({ data: { id, testOnly: false } });
                  setStatus(
                    `Sent to ${res.sent} subscriber${res.sent === 1 ? "" : "s"}${
                      res.failed ? ` — ${res.failed} failed` : ""
                    }.`,
                  );
                  await refresh();
                });
              }}
            >
              <Send className="h-4 w-4" /> Send edition
            </button>
            <button
              type="button"
              className="text-sm text-ink/60 underline"
              onClick={() => setDraft(null)}
            >
              Close
            </button>
            {status && <span className="text-sm text-ink/70">{status}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
