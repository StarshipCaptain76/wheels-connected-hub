import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import {
  listAllMerchItems,
  upsertMerchItem,
  deleteMerchItem,
  type MerchItem,
} from "@/lib/merch.functions";
import { Trash2, Plus, X, Upload } from "lucide-react";
import { TranslateButton } from "@/components/TranslateButton";
import { useConfirm } from "@/components/ConfirmDialog";
import { useI18n } from "@/i18n/I18nProvider";
import { CharCounter } from "@/components/CharCounter";
import { supabase } from "@/integrations/supabase/client";


const merchAdminQuery = queryOptions({
  queryKey: ["merch", "admin"],
  queryFn: () => listAllMerchItems(),
});

export const Route = createFileRoute("/_authenticated/admin/shop")({
  head: () => ({ meta: [{ title: "Manage Shop — Just Wheels" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(merchAdminQuery),
  component: AdminShop,
  errorComponent: ({ error }) => (
    <SiteLayout>
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="text-ink/70">Access denied: {error.message}</p>
      </div>
    </SiteLayout>
  ),
});

type FormState = Partial<MerchItem> & { sizesText?: string };

function AdminShop() {
  const { data: items } = useSuspenseQuery(merchAdminQuery);
  const { lang } = useI18n();
  const qc = useQueryClient();
  const upsert = useServerFn(upsertMerchItem);
  const del = useServerFn(deleteMerchItem);
  const [editing, setEditing] = useState<FormState | null>(null);
  const confirm = useConfirm();

  async function save(form: FormState) {
    const sizes = (form.sizesText ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    await upsert({
      data: {
        id: form.id ?? null,
        name: form.name ?? "",
        name_af: form.name_af ?? null,
        description: form.description ?? null,
        description_af: form.description_af ?? null,
        price_zar: form.price_zar ?? null,
        sizes,
        image_url: form.image_url ?? null,
        is_active: form.is_active ?? true,
        sort: form.sort ?? 0,
      },
    });
    await qc.invalidateQueries({ queryKey: ["merch"] });
    setEditing(null);
  }

  async function remove(id: string) {
    if (!(await confirm({ title: "Delete this item?", description: "It will be removed from the shop." }))) return;
    await del({ data: { id } });
    await qc.invalidateQueries({ queryKey: ["merch"] });
  }

  return (
    <SiteLayout>
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex items-end justify-between gap-4">
          <h1 className="font-display text-4xl tracking-wide text-ink">
            {lang === "af" ? "Bestuur winkel" : "Manage shop"}
          </h1>
          <button
            type="button"
            onClick={() =>
              setEditing({ is_active: true, sort: (items.at(-1)?.sort ?? 0) + 10, sizesText: "" })
            }
            className="inline-flex items-center gap-2 rounded-md border-2 border-ink bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-paper"
          >
            <Plus className="h-4 w-4" /> {lang === "af" ? "Nuwe item" : "New item"}
          </button>
        </div>

        <ul className="mt-6 space-y-3">
          {items.map((item) => {
            const name = lang === "af" && item.name_af ? item.name_af : item.name;
            const desc = lang === "af" && item.description_af ? item.description_af : item.description;
            return (
            <li
              key={item.id}
              className="flex gap-4 rounded-lg border-2 border-ink bg-card p-4 shadow-[3px_3px_0_0_var(--color-ink)]"
            >
              <div className="h-20 w-20 flex-none overflow-hidden rounded border-2 border-ink bg-steel/20">
                {item.image_url ? (
                  <img src={item.image_url} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary">
                  {item.is_active
                    ? lang === "af"
                      ? "Aktief"
                      : "Active"
                    : lang === "af"
                      ? "Versteek"
                      : "Hidden"}{" "}
                  · {lang === "af" ? "volgorde" : "sort"} {item.sort}
                </div>
                <p className="font-display text-lg text-ink">{name}</p>
                {desc ? <p className="text-sm text-ink/70">{desc}</p> : null}
                <p className="text-sm text-ink/70">
                  {item.price_zar != null
                    ? `R${item.price_zar}`
                    : lang === "af"
                      ? "Prys op aanvraag"
                      : "Price on request"}
                  {item.sizes.length > 0 ? ` · ${item.sizes.join(", ")}` : ""}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setEditing({ ...item, sizesText: item.sizes.join(", ") })}
                  className="rounded border-2 border-ink bg-paper px-3 py-1 text-xs font-bold uppercase"
                >
                  {lang === "af" ? "Wysig" : "Edit"}
                </button>
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  className="rounded border-2 border-primary bg-primary p-2 text-paper hover:opacity-90"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
            );
          })}
        </ul>

        {editing && <EditModal state={editing} onSave={save} onClose={() => setEditing(null)} />}
      </div>
    </SiteLayout>
  );
}

function EditModal({
  state,
  onSave,
  onClose,
}: {
  state: FormState;
  onSave: (s: FormState) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormState>(state);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [upErr, setUpErr] = useState<string | null>(null);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  /** Upload an item photo to the public gallery bucket under merch/. */
  async function uploadPhoto(file: File | null) {
    if (!file) return;
    setUpErr(null);
    if (!file.type.startsWith("image/")) {
      setUpErr("Please choose an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUpErr("Max 5MB per photo");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `merch/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("gallery")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (error) throw error;
      const { data } = await supabase.storage
        .from("gallery")
        .createSignedUrl(path, 60 * 60 * 24 * 7);
      set("image_url", data?.signedUrl ?? "");
    } catch (e) {
      setUpErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }


  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await onSave(form);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg space-y-3 rounded-2xl border-2 border-ink bg-paper p-6 shadow-[6px_6px_0_0_hsl(var(--ink))]"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-ink">{form.id ? "Edit item" : "New item"}</h2>
          <button type="button" onClick={onClose} className="rounded-full border-2 border-ink p-1">
            <X className="h-4 w-4" />
          </button>
        </div>
        <Row label="Name (EN)">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <input required maxLength={120} value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} className={input} />
              <CharCounter value={form.name} max={120} />
            </div>
            <TranslateButton source={form.name_af ?? ""} from="af" to="en" onResult={(t) => set("name", t)} />
          </div>
        </Row>
        <Row label="Name (AF)">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <input maxLength={120} value={form.name_af ?? ""} onChange={(e) => set("name_af", e.target.value)} className={input} />
              <CharCounter value={form.name_af} max={120} />
            </div>
            <TranslateButton source={form.name ?? ""} from="en" to="af" onResult={(t) => set("name_af", t)} />
          </div>
        </Row>
        <Row label="Description (EN)">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <textarea rows={2} maxLength={1000} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} className={input} />
              <CharCounter value={form.description} max={1000} />
            </div>
            <TranslateButton source={form.description_af ?? ""} from="af" to="en" onResult={(t) => set("description", t)} />
          </div>
        </Row>
        <Row label="Description (AF)">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <textarea rows={2} maxLength={1000} value={form.description_af ?? ""} onChange={(e) => set("description_af", e.target.value)} className={input} />
              <CharCounter value={form.description_af} max={1000} />
            </div>
            <TranslateButton source={form.description ?? ""} from="en" to="af" onResult={(t) => set("description_af", t)} />
          </div>
        </Row>

        <div className="grid grid-cols-2 gap-3">
          <Row label="Price (ZAR)">
            <input
              type="number"
              step="0.01"
              value={form.price_zar ?? ""}
              onChange={(e) => set("price_zar", e.target.value === "" ? null : Number(e.target.value))}
              className={input}
            />
          </Row>
          <Row label="Sort">
            <input
              type="number"
              value={form.sort ?? 0}
              onChange={(e) => set("sort", Number(e.target.value))}
              className={input}
            />
          </Row>
        </div>
        <Row label="Sizes (comma separated)">
          <input
            value={form.sizesText ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, sizesText: e.target.value }))}
            placeholder="S, M, L, XL"
            className={input}
          />
        </Row>
        <Row label="Item photo">
          <div className="mt-1 flex items-center gap-3">
            <div className="h-20 w-20 flex-none overflow-hidden rounded border-2 border-ink bg-steel/20">
              {form.image_url ? (
                <img src={form.image_url} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border-2 border-ink bg-paper px-3 py-2 text-xs font-bold uppercase tracking-wider">
                <Upload className="h-4 w-4" />
                {uploading ? "Uploading…" : form.image_url ? "Replace photo" : "Upload photo"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => void uploadPhoto(e.target.files?.[0] ?? null)}
                />
              </label>
              {form.image_url ? (
                <button
                  type="button"
                  onClick={() => set("image_url", null)}
                  className="text-xs font-bold uppercase tracking-wider text-primary"
                >
                  Remove photo
                </button>
              ) : null}
              {upErr ? <p className="text-xs text-primary">{upErr}</p> : null}
            </div>
          </div>
        </Row>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.is_active ?? true}
            onChange={(e) => set("is_active", e.target.checked)}
          />
          <span className="text-sm">Active (visible in shop)</span>
        </label>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md border-2 border-ink bg-primary px-4 py-3 font-bold uppercase tracking-wider text-paper disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </form>
    </div>
  );
}

const input = "mt-1 w-full rounded-md border-2 border-ink bg-paper px-3 py-2";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wider text-ink/70">{label}</span>
      {children}
    </label>
  );
}
