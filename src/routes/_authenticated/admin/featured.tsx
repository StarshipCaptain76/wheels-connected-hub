import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import {
  listAllMembers,
  setFeaturedMember,
  type AdminMember,
} from "@/lib/admin-members.functions";
import { Star, X } from "lucide-react";

const membersQuery = queryOptions({
  queryKey: ["admin", "members"],
  queryFn: () => listAllMembers(),
});

export const Route = createFileRoute("/_authenticated/admin/featured")({
  head: () => ({
    meta: [{ title: "Featured Member — Admin — Just Wheels" }, { name: "robots", content: "noindex" }],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(membersQuery),
  component: AdminFeatured,
});

function AdminFeatured() {
  const { data: members } = useSuspenseQuery(membersQuery);
  const qc = useQueryClient();
  const setFeatured = useServerFn(setFeaturedMember);

  const current = useMemo(() => members.find((m: AdminMember) => m.is_featured) ?? null, [members]);
  const [picking, setPicking] = useState(false);
  const [bio, setBio] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(userId: string | null) {
    setBusy(true);
    setError(null);
    try {
      await setFeatured({ data: { userId, bio: bio || null, photoUrl: photoUrl || null } });
      await qc.invalidateQueries({ queryKey: ["admin", "members"] });
      await qc.invalidateQueries({ queryKey: ["featured-member"] });
      setPicking(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-4xl tracking-wide text-ink">Featured member</h1>
      <p className="mt-1 text-sm text-ink/60">
        Exactly one member is featured on the public site at a time.
      </p>

      {error && (
        <p className="mt-3 rounded border-2 border-primary bg-primary/10 px-3 py-2 text-sm text-primary">{error}</p>
      )}

      <div className="mt-6 rounded-2xl border-2 border-ink bg-paper p-6 shadow-[4px_4px_0_0_var(--color-ink)]">
        {current ? (
          <div className="flex flex-col gap-4 sm:flex-row">
            {current && (current as AdminMember & { featured_photo_url?: string | null }).favourite_ride ? null : null}
            <div className="flex-1">
              <p className="font-display text-xs tracking-[0.3em] text-primary">CURRENTLY FEATURED</p>
              <h2 className="mt-1 font-display text-3xl text-ink">{current.display_name ?? "—"}</h2>
              <p className="text-sm text-ink/70">
                #{String(current.member_number).padStart(4, "0")}
                {current.town ? ` · ${current.town}` : ""}
              </p>
              {current.favourite_ride && (
                <p className="mt-2 text-sm text-ink/70">🚗 {current.favourite_ride}</p>
              )}

              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-ink/70">
                    Featured bio (optional)
                  </span>
                  <textarea
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Short story to display on the site…"
                    className="mt-1 w-full rounded-md border-2 border-ink bg-paper px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-ink/70">
                    Featured photo URL (optional)
                  </span>
                  <input
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    placeholder="https://…"
                    className="mt-1 w-full rounded-md border-2 border-ink bg-paper px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => save(current.user_id)}
                  className="rounded-md border-2 border-ink bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-paper disabled:opacity-60"
                >
                  {busy ? "Saving…" : "Save bio & photo"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setPicking(true)}
                  className="rounded-md border-2 border-ink bg-paper px-4 py-2 text-sm font-bold uppercase tracking-wider text-ink"
                >
                  Choose different member
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => save(null)}
                  className="rounded-md border-2 border-ink bg-paper px-4 py-2 text-sm font-bold uppercase tracking-wider text-ink hover:bg-ink/5"
                >
                  Clear featured
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-ink/70">No featured member is currently set.</p>
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-md border-2 border-ink bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-paper"
            >
              <Star className="h-4 w-4" /> Pick a featured member
            </button>
          </div>
        )}
      </div>

      {picking && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4"
          onClick={() => setPicking(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl border-2 border-ink bg-paper p-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl text-ink">Pick a member</h3>
              <button onClick={() => setPicking(false)} className="rounded-full border-2 border-ink p-1">
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="mt-3 space-y-1">
              {members.map((m: AdminMember) => (
                <li key={m.user_id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => save(m.user_id)}
                    className="flex w-full items-center justify-between rounded border-2 border-ink px-3 py-2 text-left text-sm hover:bg-ink/5"
                  >
                    <span>
                      <span className="font-mono text-xs text-ink/60">
                        #{String(m.member_number).padStart(4, "0")}
                      </span>{" "}
                      {m.display_name ?? m.email ?? "—"}
                    </span>
                    {m.is_featured && <Star className="h-4 w-4 text-primary" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
