import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { listAllMembers, type AdminMember } from "@/lib/admin-members.functions";
import {
  adminAddMemberFeaturePhoto,
  adminGetMemberFeature,
  adminListMemberFeatures,
  adminRemoveMemberFeaturePhoto,
  adminReorderMemberFeaturePhotos,
  adminSetMemberFeatureHome,
  adminSetMemberFeaturePublished,
  adminUpsertMemberFeature,
  type MemberFeature,
} from "@/lib/member-features.functions";
import { ImageUploadField } from "@/components/ImageUploadField";
import { CharCounter } from "@/components/CharCounter";
import { ChevronDown, ChevronUp, Pencil, Plus, Search } from "lucide-react";

const inp = "mt-1 w-full rounded-md border-2 border-ink bg-paper px-3 py-2 text-sm";

type FormState = {
  id?: string;
  memberUserId: string;
  headlineEn: string;
  headlineAf: string;
  deckEn: string;
  deckAf: string;
  bodyEn: string;
  bodyAf: string;
  coverUrl: string;
  published: boolean;
  showOnHome: boolean;
};

const emptyForm = (): FormState => ({
  memberUserId: "",
  headlineEn: "",
  headlineAf: "",
  deckEn: "",
  deckAf: "",
  bodyEn: "",
  bodyAf: "",
  coverUrl: "",
  published: false,
  showOnHome: false,
});

function fromFeature(f: MemberFeature): FormState {
  return {
    id: f.id,
    memberUserId: f.member_user_id,
    headlineEn: f.headline_en,
    headlineAf: f.headline_af ?? "",
    deckEn: f.deck_en ?? "",
    deckAf: f.deck_af ?? "",
    bodyEn: f.body_en,
    bodyAf: f.body_af ?? "",
    coverUrl: f.cover_url ?? "",
    published: f.published,
    showOnHome: f.show_on_home,
  };
}

function statusLabel(f: MemberFeature) {
  if (f.show_on_home) return "Homepage";
  if (f.published) return "Published";
  return "Draft";
}

export function MemberFeatureAdminPanel() {
  const qc = useQueryClient();
  const upsert = useServerFn(adminUpsertMemberFeature);
  const setPublished = useServerFn(adminSetMemberFeaturePublished);
  const setHome = useServerFn(adminSetMemberFeatureHome);
  const addPhoto = useServerFn(adminAddMemberFeaturePhoto);
  const removePhoto = useServerFn(adminRemoveMemberFeaturePhoto);
  const reorderPhotos = useServerFn(adminReorderMemberFeaturePhotos);
  const getOne = useServerFn(adminGetMemberFeature);

  const membersQ = useQuery({
    queryKey: ["admin", "members"],
    queryFn: () => listAllMembers(),
  });
  const listQ = useQuery({
    queryKey: ["admin", "member-features"],
    queryFn: () => adminListMemberFeatures(),
  });

  const [form, setForm] = useState<FormState>(emptyForm());
  const [pickerQ, setPickerQ] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [extraUrl, setExtraUrl] = useState("");

  const members = membersQ.data ?? [];
  const features = listQ.data ?? [];
  const selected = members.find((m) => m.user_id === form.memberUserId) ?? null;
  const editing = form.id ? features.find((f) => f.id === form.id) : null;

  const pickerHits = useMemo(() => {
    const q = pickerQ.trim().toLowerCase();
    const base = members.filter((m) => m.membership_status !== "pending");
    if (!q) return base.slice(0, 12);
    return base
      .filter((m) =>
        [m.display_name, m.town, String(m.member_number).padStart(4, "0")]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
      )
      .slice(0, 12);
  }, [members, pickerQ]);

  function pickMember(m: AdminMember) {
    setForm((f) => ({ ...f, memberUserId: m.user_id }));
    setPickerQ(`${m.display_name ?? "Member"} · #${String(m.member_number).padStart(4, "0")}`);
    setPickerOpen(false);
  }

  function loadFeature(f: MemberFeature) {
    setForm(fromFeature(f));
    setPickerQ(
      `${f.member_display_name ?? "Member"} · #${String(f.member_number).padStart(4, "0")}`,
    );
    setMsg(null);
    setExtraUrl("");
  }

  async function reloadEditing(id: string) {
    const row = await getOne({ data: { id } });
    loadFeature(row);
    await qc.invalidateQueries({ queryKey: ["admin", "member-features"] });
  }

  async function save(extra?: Partial<FormState>) {
    const next = { ...form, ...extra };
    if (!next.memberUserId) {
      setMsg("Pick a member first.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const row = await upsert({
        data: {
          id: next.id,
          memberUserId: next.memberUserId,
          headlineEn: next.headlineEn,
          headlineAf: next.headlineAf || null,
          deckEn: next.deckEn || null,
          deckAf: next.deckAf || null,
          bodyEn: next.bodyEn,
          bodyAf: next.bodyAf || null,
          coverUrl: next.coverUrl || null,
          published: next.published,
          showOnHome: next.showOnHome,
        },
      });
      loadFeature(row);
      await qc.invalidateQueries({ queryKey: ["admin", "member-features"] });
      await qc.invalidateQueries({ queryKey: ["member-feature-home"] });
      await qc.invalidateQueries({ queryKey: ["featured-member"] });
      setMsg("Saved");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function togglePublished(f: MemberFeature, published: boolean) {
    setBusy(true);
    setMsg(null);
    try {
      const row = await setPublished({ data: { id: f.id, published } });
      if (form.id === f.id) loadFeature(row);
      await qc.invalidateQueries({ queryKey: ["admin", "member-features"] });
      await qc.invalidateQueries({ queryKey: ["member-feature-home"] });
      setMsg(published ? "Published" : "Unpublished");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleHome(f: MemberFeature, on: boolean) {
    setBusy(true);
    setMsg(null);
    try {
      const row = await setHome({ data: { id: f.id, showOnHome: on } });
      if (form.id === f.id) loadFeature(row);
      await qc.invalidateQueries({ queryKey: ["admin", "member-features"] });
      await qc.invalidateQueries({ queryKey: ["member-feature-home"] });
      await qc.invalidateQueries({ queryKey: ["featured-member"] });
      setMsg(on ? "On homepage" : "Removed from homepage");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function onExtraUploaded(url: string) {
    if (!form.id || !url) return;
    setBusy(true);
    try {
      await addPhoto({ data: { featureId: form.id, url } });
      setExtraUrl("");
      await reloadEditing(form.id);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Photo failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-2xl text-ink">Member features</h2>
        <button
          type="button"
          onClick={() => {
            setForm(emptyForm());
            setPickerQ("");
            setMsg(null);
            setExtraUrl("");
          }}
          className="inline-flex items-center gap-1 rounded-md border-2 border-ink bg-primary px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-paper"
        >
          <Plus className="h-3.5 w-3.5" /> New feature
        </button>
      </div>

      {msg && (
        <p className="rounded border-2 border-primary bg-primary/10 px-3 py-2 text-sm font-bold text-primary">
          {msg}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border-2 border-ink">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-black text-white">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-bold uppercase">Status</th>
              <th className="px-3 py-2 text-left text-xs font-bold uppercase">Member</th>
              <th className="px-3 py-2 text-left text-xs font-bold uppercase">Headline</th>
              <th className="px-3 py-2 text-left text-xs font-bold uppercase">Date</th>
              <th className="px-3 py-2 text-left text-xs font-bold uppercase"> </th>
            </tr>
          </thead>
          <tbody>
            {features.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-ink/50">
                  No features yet.
                </td>
              </tr>
            )}
            {features.map((f) => (
              <tr key={f.id} className="border-t border-ink/10 bg-paper">
                <td className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-primary">
                  {statusLabel(f)}
                </td>
                <td className="px-3 py-2">
                  {f.member_display_name ?? "—"}{" "}
                  <span className="text-ink/50">#{String(f.member_number).padStart(4, "0")}</span>
                </td>
                <td className="px-3 py-2">{f.headline_en || "—"}</td>
                <td className="px-3 py-2 text-xs text-ink/60">
                  {(f.published_at || f.updated_at)
                    ? new Date(f.published_at || f.updated_at).toLocaleDateString("en-ZA")
                    : "—"}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => loadFeature(f)}
                      className="inline-flex items-center gap-1 rounded border-2 border-ink bg-paper px-2 py-1 text-[10px] font-bold uppercase"
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                    {f.published ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void togglePublished(f, false)}
                        className="rounded border-2 border-ink bg-paper px-2 py-1 text-[10px] font-bold uppercase"
                      >
                        Unpublish
                      </button>
                    ) : null}
                    {f.published ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void toggleHome(f, !f.show_on_home)}
                        className="rounded border-2 border-ink bg-paper px-2 py-1 text-[10px] font-bold uppercase"
                      >
                        {f.show_on_home ? "Off home" : "Set home"}
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-4 rounded-xl border-2 border-ink bg-card p-4 shadow-[4px_4px_0_0_var(--color-ink)]">
        <h3 className="font-display text-xl text-ink">{form.id ? "Edit feature" : "New feature"}</h3>

        <div className="relative">
          <span className="text-xs font-bold uppercase tracking-wider text-ink/70">Member</span>
          <div className="relative mt-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
            <input
              value={pickerQ}
              onChange={(e) => {
                setPickerQ(e.target.value);
                setPickerOpen(true);
              }}
              onFocus={() => setPickerOpen(true)}
              placeholder="Search #, name, town…"
              className={`${inp} pl-8`}
            />
          </div>
          {pickerOpen && (
            <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border-2 border-ink bg-paper">
              {pickerHits.map((m) => (
                <li key={m.user_id}>
                  <button
                    type="button"
                    onClick={() => pickMember(m)}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-primary/10"
                  >
                    <span className="font-bold">#{String(m.member_number).padStart(4, "0")}</span>{" "}
                    {m.display_name ?? "—"}
                    {m.town ? <span className="text-ink/50"> · {m.town}</span> : null}
                  </button>
                </li>
              ))}
              {pickerHits.length === 0 && (
                <li className="px-3 py-2 text-sm text-ink/50">No matches.</li>
              )}
            </ul>
          )}
        </div>

        {selected && (
          <p className="text-sm text-ink/70">
            <span className="font-bold">{selected.display_name}</span>
            {` · #${String(selected.member_number).padStart(4, "0")}`}
            {selected.town ? ` · ${selected.town}` : ""}
            {selected.favourite_ride ? ` · ${selected.favourite_ride}` : ""}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-ink/70">Headline (EN)</span>
            <input
              value={form.headlineEn}
              maxLength={160}
              onChange={(e) => setForm({ ...form, headlineEn: e.target.value })}
              className={inp}
            />
            <CharCounter value={form.headlineEn} max={160} />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-ink/70">Headline (AF)</span>
            <input
              value={form.headlineAf}
              maxLength={160}
              onChange={(e) => setForm({ ...form, headlineAf: e.target.value })}
              className={inp}
            />
            <CharCounter value={form.headlineAf} max={160} />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-ink/70">Deck (EN)</span>
            <textarea
              value={form.deckEn}
              maxLength={400}
              rows={2}
              onChange={(e) => setForm({ ...form, deckEn: e.target.value })}
              className={inp}
            />
            <CharCounter value={form.deckEn} max={400} />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-ink/70">Deck (AF)</span>
            <textarea
              value={form.deckAf}
              maxLength={400}
              rows={2}
              onChange={(e) => setForm({ ...form, deckAf: e.target.value })}
              className={inp}
            />
            <CharCounter value={form.deckAf} max={400} />
          </label>
        </div>

        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-ink/70">Story (EN)</span>
          <textarea
            value={form.bodyEn}
            maxLength={8000}
            rows={8}
            onChange={(e) => setForm({ ...form, bodyEn: e.target.value })}
            className={inp}
          />
          <CharCounter value={form.bodyEn} max={8000} />
        </label>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-ink/70">Story (AF)</span>
          <textarea
            value={form.bodyAf}
            maxLength={8000}
            rows={8}
            onChange={(e) => setForm({ ...form, bodyAf: e.target.value })}
            className={inp}
          />
          <CharCounter value={form.bodyAf} max={8000} />
        </label>

        {!form.id ? (
          <p className="text-sm text-ink/60">Save a draft first, then upload the cover and extra photos.</p>
        ) : (
          <>
            <ImageUploadField
              label="Cover photo (required to publish)"
              value={form.coverUrl}
              onChange={(v) => {
                setForm((f) => ({ ...f, coverUrl: v }));
                if (form.id) void save({ coverUrl: v });
              }}
              bucket="gallery"
              folder={`member-features/${form.id}`}
              maxMb={6}
            />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-ink/70">
                Extra photos ({editing?.photos.length ?? 0}/8)
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(editing?.photos ?? []).map((p, i, all) => (
                  <div key={p.id} className="relative h-20 w-20 overflow-hidden rounded-md border-2 border-ink">
                    <img src={p.url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        if (!form.id) return;
                        setBusy(true);
                        try {
                          await removePhoto({ data: { photoId: p.id } });
                          await reloadEditing(form.id);
                        } finally {
                          setBusy(false);
                        }
                      }}
                      className="absolute right-0.5 top-0.5 rounded bg-primary px-1 text-[9px] font-bold uppercase text-paper"
                    >
                      Del
                    </button>
                    {all.length > 1 && (
                      <div className="absolute bottom-0.5 left-0.5 flex flex-col gap-0.5">
                        <button
                          type="button"
                          disabled={busy || i === 0}
                          onClick={async () => {
                            if (!form.id) return;
                            const ids = all.map((x) => x.id);
                            [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
                            setBusy(true);
                            try {
                              await reorderPhotos({ data: { featureId: form.id, orderedIds: ids } });
                              await reloadEditing(form.id);
                            } finally {
                              setBusy(false);
                            }
                          }}
                          className="rounded bg-paper/90 p-0.5 disabled:opacity-30"
                          aria-label="Move up"
                        >
                          <ChevronUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          disabled={busy || i === all.length - 1}
                          onClick={async () => {
                            if (!form.id) return;
                            const ids = all.map((x) => x.id);
                            [ids[i + 1], ids[i]] = [ids[i], ids[i + 1]];
                            setBusy(true);
                            try {
                              await reorderPhotos({ data: { featureId: form.id, orderedIds: ids } });
                              await reloadEditing(form.id);
                            } finally {
                              setBusy(false);
                            }
                          }}
                          className="rounded bg-paper/90 p-0.5 disabled:opacity-30"
                          aria-label="Move down"
                        >
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {(editing?.photos.length ?? 0) < 8 && (
                <div className="mt-2">
                  <ImageUploadField
                    label="Add extra photo"
                    value={extraUrl}
                    onChange={(v) => {
                      setExtraUrl(v);
                      if (v) void onExtraUploaded(v);
                    }}
                    bucket="gallery"
                    folder={`member-features/${form.id}`}
                    maxMb={6}
                  />
                </div>
              )}
            </div>
          </>
        )}

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.published}
            onChange={(e) => setForm({ ...form, published: e.target.checked })}
          />
          <span className="text-sm font-bold">Published (public story page)</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.showOnHome}
            onChange={(e) =>
              setForm({
                ...form,
                showOnHome: e.target.checked,
                published: e.target.checked ? true : form.published,
              })
            }
          />
          <span className="text-sm font-bold">Publish to homepage (only one at a time)</span>
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="rounded-md border-2 border-ink bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-paper disabled:opacity-50"
          >
            {busy ? "Saving…" : form.id ? "Save" : "Save draft"}
          </button>
          {form.id && editing?.slug && (
            <Link
              to="/features/$slug"
              params={{ slug: editing.slug }}
              className="rounded-md border-2 border-ink bg-paper px-4 py-2 text-sm font-bold uppercase tracking-wider text-ink"
            >
              {form.published ? "View page" : "Preview"}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
