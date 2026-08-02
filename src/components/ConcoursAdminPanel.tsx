import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useI18n } from "@/i18n/I18nProvider";
import { useConfirm } from "@/components/ConfirmDialog";
import { ImageUploadField } from "@/components/ImageUploadField";
import { CharCounter } from "@/components/CharCounter";
import {
  getEventConcours,
  listConcoursQuestions,
  listConcoursVehicles,
  upsertEventConcours,
  revealConcoursLeaderboard,
  addConcoursVehicle,
  deleteConcoursVehicle,
} from "@/lib/concours.functions";
import { Trash2, Trophy, Shuffle } from "lucide-react";

export function ConcoursAdminPanel({ eventId }: { eventId?: string | null }) {
  const { lang } = useI18n();
  const qc = useQueryClient();
  const confirm = useConfirm();

  const save = useServerFn(upsertEventConcours);
  const reveal = useServerFn(revealConcoursLeaderboard);
  const addVehicle = useServerFn(addConcoursVehicle);
  const delVehicle = useServerFn(deleteConcoursVehicle);

  const concours = useQuery({
    queryKey: ["concours", eventId],
    queryFn: () => getEventConcours({ data: { eventId: eventId! } }),
    enabled: Boolean(eventId),
  });
  const vehicles = useQuery({
    queryKey: ["concours-vehicles", eventId],
    queryFn: () => listConcoursVehicles({ data: { eventId: eventId! } }),
    enabled: Boolean(eventId),
  });
  const questions = useQuery({
    queryKey: ["concours-questions", concours.data?.selected_question_ids],
    queryFn: () =>
      listConcoursQuestions({ data: { ids: concours.data?.selected_question_ids ?? [] } }),
    enabled: Boolean(concours.data?.selected_question_ids?.length),
  });

  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [prizeEn, setPrizeEn] = useState<string | null>(null);
  const [prizeAf, setPrizeAf] = useState<string | null>(null);
  const [sponsorName, setSponsorName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");
  const [label, setLabel] = useState("");

  if (!eventId) {
    return (
      <p className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        {lang === "af"
          ? "Stoor eers die geleentheid, dan kan jy die Concours opstel."
          : "Save the event first, then you can set up the Concours."}
      </p>
    );
  }

  const c = concours.data;
  const isEnabled = enabled ?? c?.enabled ?? false;
  const qCount = count ?? c?.question_count ?? 8;

  async function persist(reRoll = false) {
    setBusy(true);
    try {
      await save({
        data: {
          eventId: eventId!,
          enabled: isEnabled,
          questionCount: qCount,
          prizeEn: prizeEn ?? c?.prize_en ?? null,
          prizeAf: prizeAf ?? c?.prize_af ?? null,
          sponsorName: sponsorName ?? c?.sponsor_name ?? null,
          sponsorLogoUrl: c?.sponsor_logo_url ?? null,
          reRollQuestions: reRoll,
        },
      });
      await qc.invalidateQueries({ queryKey: ["concours", eventId] });
      toast.success(lang === "af" ? "Concours gestoor" : "Concours saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-lg border border-border p-4">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          {lang === "af" ? "Concours-uitdaging aktief" : "Concours challenge enabled"}
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              {lang === "af" ? "Aantal vrae (5–15)" : "Number of questions (5–15)"}
            </label>
            <input
              type="number"
              min={5}
              max={15}
              value={qCount}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              {lang === "af" ? "Borg se naam" : "Sponsor name"}
            </label>
            <input
              value={sponsorName ?? c?.sponsor_name ?? ""}
              maxLength={120}
              onChange={(e) => setSponsorName(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <CharCounter value={sponsorName ?? c?.sponsor_name ?? ""} max={120} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Prize (EN)</label>
            <input
              value={prizeEn ?? c?.prize_en ?? ""}
              maxLength={300}
              onChange={(e) => setPrizeEn(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <CharCounter value={prizeEn ?? c?.prize_en ?? ""} max={300} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Prys (AF)</label>
            <input
              value={prizeAf ?? c?.prize_af ?? ""}
              maxLength={300}
              onChange={(e) => setPrizeAf(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <CharCounter value={prizeAf ?? c?.prize_af ?? ""} max={300} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => persist(false)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {lang === "af" ? "Stoor Concours" : "Save Concours"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => persist(true)}
            className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm disabled:opacity-60"
          >
            <Shuffle className="h-4 w-4" />
            {lang === "af" ? "Kies nuwe vrae" : "Re-roll questions"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              try {
                await reveal({
                  data: { eventId, revealed: !(c?.leaderboard_revealed ?? false) },
                });
                await qc.invalidateQueries({ queryKey: ["concours", eventId] });
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Failed");
              }
            }}
            className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm disabled:opacity-60"
          >
            <Trophy className="h-4 w-4" />
            {c?.leaderboard_revealed
              ? lang === "af"
                ? "Versteek uitslae"
                : "Hide leaderboard"
              : lang === "af"
                ? "Wys uitslae"
                : "Reveal leaderboard"}
          </button>
        </div>
      </section>

      {questions.data && questions.data.length > 0 && (
        <section className="rounded-lg border border-border p-4">
          <h3 className="mb-2 text-sm font-semibold">
            {lang === "af" ? "Gekose vrae" : "Selected questions"}
          </h3>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            {questions.data.map((q) => (
              <li key={q.id}>{lang === "af" ? q.text_af : q.text_en}</li>
            ))}
          </ol>
        </section>
      )}

      <section className="space-y-3 rounded-lg border border-border p-4">
        <h3 className="text-sm font-semibold">
          {lang === "af" ? "Voertuie om te beoordeel" : "Vehicles to judge"}
        </h3>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              {lang === "af" ? "Foto" : "Photo"}
            </label>
            <ImageUploadField
              bucket="events"
              folder="concours"
              value={photoUrl}
              onChange={(v) => setPhotoUrl(v)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              {lang === "af" ? "Beskrywing" : "Label"}
            </label>
            <input
              value={label}
              maxLength={120}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <CharCounter value={label} max={120} />
            <button
              type="button"
              disabled={!photoUrl || busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await addVehicle({
                    data: { eventId, photoUrl, label: label || null, labelAf: null },
                  });
                  setPhotoUrl("");
                  setLabel("");
                  await qc.invalidateQueries({ queryKey: ["concours-vehicles", eventId] });
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                } finally {
                  setBusy(false);
                }
              }}
              className="mt-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {lang === "af" ? "Voeg voertuig by" : "Add vehicle"}
            </button>
          </div>
        </div>

        <ul className="grid gap-3 sm:grid-cols-3">
          {(vehicles.data ?? []).map((v) => (
            <li key={v.id} className="overflow-hidden rounded-lg border border-border">
              <img src={v.photo_url} alt={v.label ?? ""} className="h-32 w-full object-cover" />
              <div className="flex items-center justify-between gap-2 p-2 text-xs">
                <span className="truncate">{v.label ?? "—"}</span>
                <button
                  type="button"
                  aria-label="Delete"
                  onClick={async () => {
                    const ok = await confirm({
                      title: lang === "af" ? "Verwyder voertuig?" : "Remove vehicle?",
                    });
                    if (!ok) return;
                    await delVehicle({ data: { vehicleId: v.id } });
                    await qc.invalidateQueries({ queryKey: ["concours-vehicles", eventId] });
                  }}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
