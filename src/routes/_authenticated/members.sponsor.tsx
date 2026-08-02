import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { ImageUploadField } from "@/components/ImageUploadField";
import { getMySponsor, updateMySponsor, type MySponsor } from "@/lib/sponsors.functions";
import { ArrowLeft, Handshake, TriangleAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/members/sponsor")({
  head: () => ({
    meta: [
      { title: "My sponsor card — Just Wheels Hessequa" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MySponsorPage,
});

const input = "mt-1 w-full rounded-md border-2 border-ink bg-paper px-3 py-2 text-ink";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso + "T12:00:00").toLocaleDateString("en-ZA", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function MySponsorPage() {
  const qc = useQueryClient();
  const fetchSponsor = useServerFn(getMySponsor);
  const saveSponsor = useServerFn(updateMySponsor);

  const { data: sponsor, isLoading } = useQuery({
    queryKey: ["sponsor", "mine"],
    queryFn: () => fetchSponsor(),
  });

  const [form, setForm] = useState<Partial<MySponsor>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (sponsor) setForm(sponsor);
  }, [sponsor]);

  const locked = Boolean(sponsor?.expired);

  return (
    <SiteLayout>
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Link
          to="/members"
          className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ink/70"
        >
          <ArrowLeft className="h-4 w-4" /> Back to members
        </Link>

        <h1 className="mt-4 flex items-center gap-2 font-display text-3xl tracking-wide text-ink">
          <Handshake className="h-6 w-6 text-primary" /> My sponsor card
        </h1>

        {isLoading ? (
          <p className="mt-6 text-ink/60">Loading…</p>
        ) : !sponsor ? (
          <div className="mt-6 rounded-2xl border-2 border-ink bg-card p-6">
            <p className="text-ink/80">
              You don’t have a sponsor card yet. If your business has applied to sponsor the club,
              the admin will assign the card to your profile once approved.
            </p>
            <Link
              to="/sponsors"
              className="mt-4 inline-block rounded-md border-2 border-ink bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-white"
            >
              Apply to sponsor
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-4 rounded-lg border-2 border-ink/20 bg-paper p-4 text-sm">
              <p className="text-ink/80">
                Sponsorship period: <strong>{fmt(sponsor.billing_starts_at)}</strong> →{" "}
                <strong>{fmt(sponsor.billing_ends_at)}</strong>
              </p>
              <p className="mt-1 text-ink/60">
                Card status: {sponsor.is_active ? "Live on the site" : "Awaiting admin activation"}
              </p>
            </div>

            {locked && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border-2 border-primary bg-primary/10 p-4">
                <TriangleAlert className="mt-0.5 h-5 w-5 flex-none text-primary" />
                <p className="text-sm text-ink">
                  Your sponsorship has <strong>expired</strong>, so this card can no longer be
                  edited. Please contact the club admin at{" "}
                  <a className="underline" href="mailto:admin@justwheels.co.za">
                    admin@justwheels.co.za
                  </a>{" "}
                  to renew.
                </p>
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setMsg(null);
                try {
                  await saveSponsor({
                    data: {
                      name: form.name ?? "",
                      tagline: form.tagline ?? null,
                      tagline_af: form.tagline_af ?? null,
                      website_url: form.website_url ?? null,
                      logo_path: form.logo_path ?? "",
                    },
                  });
                  await qc.invalidateQueries({ queryKey: ["sponsor", "mine"] });
                  await qc.invalidateQueries({ queryKey: ["sponsors"] });
                  setMsg("Saved — thank you!");
                } catch (err) {
                  setMsg(err instanceof Error ? err.message : "Save failed");
                } finally {
                  setBusy(false);
                }
              }}
              className="mt-6 space-y-4 rounded-2xl border-2 border-ink bg-card p-6 shadow-[4px_4px_0_0_var(--color-ink)]"
            >
              <fieldset disabled={locked} className="space-y-4 disabled:opacity-60">
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-ink/70">
                    Business name
                  </span>
                  <input
                    required
                    value={form.name ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className={input}
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-ink/70">
                    Tagline (English)
                  </span>
                  <input
                    maxLength={200}
                    value={form.tagline ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
                    className={input}
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-ink/70">
                    Slagspreuk (Afrikaans)
                  </span>
                  <input
                    maxLength={200}
                    value={form.tagline_af ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, tagline_af: e.target.value }))}
                    className={input}
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-ink/70">
                    Website URL
                  </span>
                  <input
                    value={form.website_url ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, website_url: e.target.value }))}
                    className={input}
                    placeholder="https://"
                  />
                </label>

                <ImageUploadField
                  label="Logo"
                  value={form.logo_path ?? ""}
                  onChange={(v) => setForm((f) => ({ ...f, logo_path: v }))}
                  bucket="sponsors"
                  folder="logos"
                  storePath
                  maxMb={3}
                />

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-md border-2 border-ink bg-primary px-4 py-3 font-bold uppercase tracking-wider text-white disabled:opacity-60"
                >
                  {busy ? "Saving…" : "Save sponsor card"}
                </button>
              </fieldset>
              {msg && <p className="text-sm font-medium text-ink">{msg}</p>}
            </form>
          </>
        )}
      </div>
    </SiteLayout>
  );
}
