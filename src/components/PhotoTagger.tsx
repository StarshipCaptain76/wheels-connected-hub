import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Tag, X, UserPlus, Search, Mail } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { listDirectoryMembers } from "@/lib/directory.functions";
import {
  addPhotoTag,
  inviteTagByEmail,
  listTagsForPhoto,
  removePhotoTag,
} from "@/lib/gallery-tags.functions";

/** Tag club members in a gallery photo, or invite someone by email. */
export function PhotoTagger({ galleryItemId }: { galleryItemId: string }) {
  const { lang } = useI18n();
  const qc = useQueryClient();
  const af = lang === "af";

  const listTags = useServerFn(listTagsForPhoto);
  const listMembers = useServerFn(listDirectoryMembers);
  const addTag = useServerFn(addPhotoTag);
  const removeTag = useServerFn(removePhotoTag);
  const invite = useServerFn(inviteTagByEmail);

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const tagsQuery = useQuery({
    queryKey: ["photo-tags", galleryItemId],
    queryFn: () => listTags({ data: { galleryItemId } }),
  });
  const tags = tagsQuery.data ?? [];

  const membersQuery = useQuery({
    queryKey: ["directory-members-tagging"],
    queryFn: () => listMembers({ data: {} }),
    enabled: open,
    staleTime: 5 * 60_000,
  });

  const tagged = new Set(tags.map((t) => t.tagged_user_id));
  const needle = q.trim().toLowerCase();
  const candidates = (membersQuery.data ?? [])
    .filter((m) => !tagged.has(m.user_id))
    .filter((m) =>
      needle
        ? [m.display_name, m.town, String(m.member_number)]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(needle))
        : true,
    )
    .slice(0, 40);

  async function onAdd(userId: string) {
    setBusy(true);
    try {
      await addTag({ data: { galleryItemId, taggedUserId: userId } });
      await qc.invalidateQueries({ queryKey: ["photo-tags", galleryItemId] });
      toast.success(af ? "Lid gemerk" : "Member tagged");
      setQ("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(id: string) {
    setBusy(true);
    try {
      await removeTag({ data: { id } });
      await qc.invalidateQueries({ queryKey: ["photo-tags", galleryItemId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onInvite() {
    const value = email.trim();
    if (!value) return;
    setBusy(true);
    try {
      const res = await invite({ data: { galleryItemId, email: value, note: note.trim() || undefined } });
      toast.success(
        res.already
          ? af
            ? "Uitnodiging is reeds gestuur"
            : "Invite already sent"
          : af
            ? "Uitnodiging gestuur"
            : "Invite sent",
      );
      setEmail("");
      setNote("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border-2 border-ink bg-paper p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink/70">
          <Tag className="h-3.5 w-3.5 text-primary" />
          {af ? "Gemerkte lede" : "Tagged members"}
        </span>
        {tags.length === 0 && (
          <span className="text-xs text-ink/50">{af ? "Nog niemand nie" : "Nobody yet"}</span>
        )}
        {tags.map((t) => (
          <span
            key={t.id}
            className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-card py-0.5 pl-0.5 pr-2 text-xs font-bold text-ink"
          >
            {t.avatar_url ? (
              <img src={t.avatar_url} alt="" className="h-5 w-5 rounded-full object-cover" />
            ) : (
              <span className="grid h-5 w-5 place-items-center rounded-full bg-primary text-[9px] text-paper">
                {(t.display_name ?? "?").slice(0, 1)}
              </span>
            )}
            {t.display_name ?? (af ? "Lid" : "Member")}
            <button
              type="button"
              aria-label={af ? "Verwyder merk" : "Remove tag"}
              disabled={busy}
              onClick={() => void onRemove(t.id)}
              className="text-ink/50 hover:text-primary"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 rounded-full border-2 border-ink bg-primary px-2.5 py-1 text-xs font-bold text-paper"
        >
          <UserPlus className="h-3.5 w-3.5" />
          {af ? "Merk lid" : "Tag member"}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-3 border-t-2 border-ink/10 pt-3">
          <div className="flex items-center gap-2 rounded-lg border-2 border-ink bg-card px-2">
            <Search className="h-4 w-4 text-ink/50" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={af ? "Soek naam, dorp of lidnommer" : "Search name, town or member no."}
              className="w-full bg-transparent py-2 text-sm text-ink outline-none"
            />
          </div>

          <ul className="max-h-56 space-y-1 overflow-y-auto">
            {membersQuery.isLoading && (
              <li className="p-2 text-xs text-ink/50">{af ? "Laai…" : "Loading…"}</li>
            )}
            {!membersQuery.isLoading && candidates.length === 0 && (
              <li className="p-2 text-xs text-ink/50">
                {af ? "Geen lede gevind nie." : "No members found."}
              </li>
            )}
            {candidates.map((m) => (
              <li key={m.user_id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onAdd(m.user_id)}
                  className="flex w-full items-center gap-2 rounded-lg border-2 border-transparent px-2 py-1.5 text-left hover:border-ink hover:bg-card"
                >
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                  ) : (
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-xs text-paper">
                      {(m.display_name ?? "?").slice(0, 1)}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-ink">
                      {m.display_name ?? (af ? "Lid" : "Member")}
                    </span>
                    <span className="block truncate text-[11px] text-ink/50">
                      #{m.member_number}
                      {m.town ? " · " + m.town : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="rounded-lg border-2 border-dashed border-ink/30 p-3">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink/70">
              <Mail className="h-3.5 w-3.5 text-primary" />
              {af ? "Nie hier nie? Nooi per e-pos" : "Can't find them? Invite by email"}
            </p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="mt-2 w-full rounded-lg border-2 border-ink bg-card px-2 py-2 text-sm text-ink outline-none"
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              placeholder={af ? "Kort boodskap (opsioneel)" : "Short note (optional)"}
              className="mt-2 w-full rounded-lg border-2 border-ink bg-card px-2 py-2 text-sm text-ink outline-none"
            />
            <button
              type="button"
              disabled={busy || !email.trim()}
              onClick={() => void onInvite()}
              className="mt-2 w-full rounded-lg border-2 border-ink bg-ink px-3 py-2 text-sm font-bold text-paper disabled:opacity-50"
            >
              {af ? "Stuur uitnodiging" : "Send invite"}
            </button>
            <p className="mt-1.5 text-[11px] text-ink/50">
              {af
                ? "Die e-pos word namens jou gestuur — antwoorde kom na jou toe."
                : "The email is sent on your behalf — replies come back to you."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
