import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { useI18n } from "@/i18n/I18nProvider";
import { listSubscribers, sendNewsletter } from "@/lib/newsletter.functions";
import { Send, Users, Mail } from "lucide-react";

const subsQuery = queryOptions({
  queryKey: ["newsletter", "subscribers"],
  queryFn: () => listSubscribers(),
});

export const Route = createFileRoute("/_authenticated/admin/newsletter")({
  head: () => ({ meta: [{ title: "Newsletter — Just Wheels" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(subsQuery),
  component: AdminNewsletter,
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

function AdminNewsletter() {
  const { lang } = useI18n();
  const isAf = lang === "af";
  const { data: subs } = useSuspenseQuery(subsQuery);
  const qc = useQueryClient();
  const sendFn = useServerFn(sendNewsletter);

  const [subjectEn, setSubjectEn] = useState("");
  const [subjectAf, setSubjectAf] = useState("");
  const [bodyEn, setBodyEn] = useState("");
  const [bodyAf, setBodyAf] = useState("");
  const [status, setStatus] = useState<null | string>(null);
  const [sending, setSending] = useState(false);

  const active = subs.filter((s) => !s.unsubscribed_at);
  const unsubscribed = subs.length - active.length;

  async function submit(testOnly: boolean) {
    setSending(true);
    setStatus(null);
    try {
      const res = await sendFn({
        data: { subjectEn, subjectAf, bodyEn, bodyAf, testOnly },
      });
      setStatus(
        testOnly
          ? `Test sent (${res.sent}).`
          : `Sent to ${res.sent} subscriber${res.sent === 1 ? "" : "s"}${
              res.failed ? ` — ${res.failed} failed` : ""
            }.`,
      );
      await qc.invalidateQueries({ queryKey: ["newsletter"] });
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <SiteLayout>
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="font-display text-sm tracking-widest text-primary">
              {isAf ? "Admin" : "Admin"}
            </div>
            <h1 className="font-display text-4xl tracking-wide text-ink">
              {isAf ? "Nuusbrief" : "Newsletter"}
            </h1>
          </div>
          <div className="flex gap-3">
            <div className="rounded-lg border-2 border-ink bg-card px-4 py-2 shadow-[3px_3px_0_0_var(--color-primary)]">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink/60">
                <Users className="h-3.5 w-3.5" /> {isAf ? "Aktief" : "Active"}
              </div>
              <div className="font-display text-2xl">{active.length}</div>
            </div>
            <div className="rounded-lg border-2 border-ink bg-card px-4 py-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink/60">
                <Mail className="h-3.5 w-3.5" /> {isAf ? "Gekanselleer" : "Unsub'd"}
              </div>
              <div className="font-display text-2xl">{unsubscribed}</div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-ink/60">
                Subject (EN)
              </span>
              <input
                className="mt-1 w-full rounded-md border-2 border-ink bg-paper px-3 py-2 text-sm"
                value={subjectEn}
                onChange={(e) => setSubjectEn(e.target.value)}
                placeholder="Club news — March run"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-ink/60">
                Body (EN — HTML allowed)
              </span>
              <textarea
                rows={12}
                className="mt-1 w-full rounded-md border-2 border-ink bg-paper px-3 py-2 font-mono text-sm"
                value={bodyEn}
                onChange={(e) => setBodyEn(e.target.value)}
                placeholder="<p>Hi wheels fam…</p>"
              />
            </label>
          </div>
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-ink/60">
                Subject (AF — optional)
              </span>
              <input
                className="mt-1 w-full rounded-md border-2 border-ink bg-paper px-3 py-2 text-sm"
                value={subjectAf}
                onChange={(e) => setSubjectAf(e.target.value)}
                placeholder="Klubnuus — Maart-rit"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-ink/60">
                Body (AF — optional, HTML)
              </span>
              <textarea
                rows={12}
                className="mt-1 w-full rounded-md border-2 border-ink bg-paper px-3 py-2 font-mono text-sm"
                value={bodyAf}
                onChange={(e) => setBodyAf(e.target.value)}
                placeholder="<p>Hallo wielfamilie…</p>"
              />
            </label>
          </div>
        </div>

        <p className="mt-3 text-xs text-ink/60">
          Falls back to English content for AF subscribers if AF fields are empty. Unsubscribe link is appended automatically.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={sending || !subjectEn || !bodyEn}
            onClick={() => submit(true)}
            className="inline-flex items-center gap-2 rounded-md border-2 border-ink bg-paper px-4 py-2 text-sm font-bold uppercase tracking-wider text-ink shadow-[3px_3px_0_0_var(--color-ink)] transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none disabled:opacity-50"
          >
            <Send className="h-4 w-4" /> Send test to admin
          </button>
          <button
            type="button"
            disabled={sending || !subjectEn || !bodyEn || active.length === 0}
            onClick={() => {
              if (
                confirm(
                  `Send to ${active.length} active subscriber${active.length === 1 ? "" : "s"}?`,
                )
              )
                submit(false);
            }}
            className="inline-flex items-center gap-2 rounded-md border-2 border-ink bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-paper shadow-[3px_3px_0_0_var(--color-ink)] transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none disabled:opacity-50"
          >
            <Send className="h-4 w-4" /> Send to {active.length}
          </button>
          {status && <span className="text-sm text-ink/70">{status}</span>}
        </div>

        <div className="mt-10">
          <h2 className="font-display text-2xl tracking-wide">Subscribers</h2>
          <div className="mt-3 overflow-hidden rounded-lg border-2 border-ink">
            <table className="w-full text-sm">
              <thead className="bg-ink text-paper">
                <tr>
                  <th className="px-3 py-2 text-left font-bold uppercase tracking-wider text-xs">Email</th>
                  <th className="px-3 py-2 text-left font-bold uppercase tracking-wider text-xs">Lang</th>
                  <th className="px-3 py-2 text-left font-bold uppercase tracking-wider text-xs">Joined</th>
                  <th className="px-3 py-2 text-left font-bold uppercase tracking-wider text-xs">Source</th>
                  <th className="px-3 py-2 text-left font-bold uppercase tracking-wider text-xs">Status</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s.id} className="border-t border-ink/10 bg-paper">
                    <td className="px-3 py-2">{s.email}</td>
                    <td className="px-3 py-2 uppercase">{s.lang}</td>
                    <td className="px-3 py-2">{new Date(s.subscribed_at).toLocaleDateString()}</td>
                    <td className="px-3 py-2 text-ink/60">{s.source ?? "—"}</td>
                    <td className="px-3 py-2">
                      {s.unsubscribed_at ? (
                        <span className="rounded bg-ink/10 px-2 py-0.5 text-xs">unsubscribed</span>
                      ) : (
                        <span className="rounded bg-primary/15 px-2 py-0.5 text-xs text-primary">active</span>
                      )}
                    </td>
                  </tr>
                ))}
                {subs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-ink/50">
                      No subscribers yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
