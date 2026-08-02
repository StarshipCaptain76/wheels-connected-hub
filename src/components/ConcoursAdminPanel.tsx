import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getEventConcours,
  listConcoursVehicles,
  upsertEventConcours,
  revealConcoursLeaderboard,
  addConcoursVehicle,
  deleteConcoursVehicle,
  type EventConcours,
  type ConcoursVehicle,
} from "@/lib/concours.functions";
import { ImageUploadField } from "@/components/ImageUploadField";
import { Trash2, Plus, Trophy, Eye, EyeOff, RefreshCw } from "lucide-react";

type Props = {
  eventId: string | undefined;
};

export function ConcoursAdminPanel({ eventId }: Props) {
  const qc = useQueryClient();
  const upsert = useServerFn(upsertEventConcours);
  const reveal = useServerFn(revealConcoursLeaderboard);
  const addVehicle = useServerFn(addConcoursVehicle);
  const delVehicle = useServerFn(deleteConcoursVehicle);

  const concoursQ = useQuery({
    queryKey: ["concours", eventId],
    enabled: !!eventId,
    queryFn: () => getEventConcours({ data: { eventId: eventId! } }),
  });

  const vehiclesQ = useQuery({
    queryKey: ["concours-vehicles", eventId],
    enabled: !!eventId,
    queryFn: () => listConcoursVehicles({ data: { eventId: eventId! } }),
  });

  const [enabled, setEnabled] = useState(false);
  const [questionCount, setQuestionCount] = useState(10);
  const [prizeEn, setPrizeEn] = useState("");
  const [prizeAf, setPrizeAf] = useState("");
  const [sponsorName, setSponsorName] = useState("");
  const [sponsorLogoUrl, setSponsorLogoUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Vehicle form
  const [photoUrl, setPhotoUrl] = useState("");
  const [label, setLabel] = useState("");
  const [labelAf, setLabelAf] = useState("");

  useEffect(() => {
    const c = concoursQ.data;
    if (c) {
      setEnabled(c.enabled);
      setQuestionCount(c.question_count);
      setPrizeEn(c.prize_en ?? "");
      setPrizeAf(c.prize_af ?? "");
      setSponsorName(c.sponsor_name ?? "");
      setSponsorLogoUrl(c.sponsor_logo_url ?? "");
    }
  }, [concoursQ.data]);

  if (!eventId) {
    return (
      <p className="text-sm text-ink/60">
        Save the event first, then come back to configure Concours Mini.
      </p>
    );
  }

  async function save(reRoll = false) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await upsert({
        data: {
          eventId: eventId!,
          enabled,
          questionCount,
          prizeEn: prizeEn || null,
          prizeAf: prizeAf || null,
          sponsorName: sponsorName || null,
          sponsorLogoUrl: sponsorLogoUrl || null,
          reRollQuestions: reRoll,
        },
      });
      setMsg(
        reRoll
          ? `Questions re-rolled (${res.selectedCount} selected)`
          : `Saved · ${res.selectedCount} questions ready`,
      );
      await qc.invalidateQueries({ queryKey: ["concours", eventId] });
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleReveal() {
    if (!concoursQ.data) return;
    setBusy(true);
    try {
      await reveal({
        data: {
          eventId: eventId!,
          revealed: !concoursQ.data.leaderboard_revealed,
        },
      });
      await qc.invalidateQueries({ queryKey: ["concours", eventId] });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleAddVehicle() {
    if (!photoUrl) {
      alert("Upload a photo of the vehicle first");
      return;
    }
    setBusy(true);
    try {
      await addVehicle({
        data: {
          eventId: eventId!,
          photoUrl,
          label: label || null,
          labelAf: labelAf || null,
        },
      });
      setPhotoUrl("");
      setLabel("");
      setLabelAf("");
      await qc.invalidateQueries({ queryKey: ["concours-vehicles", eventId] });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add vehicle");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteVehicle(id: string) {
    if (!confirm("Remove this vehicle from Concours?")) return;
    setBusy(true);
    try {
      await delVehicle({ data: { vehicleId: id } });
      await qc.invalidateQueries({ queryKey: ["concours-vehicles", eventId] });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  const vehicles: ConcoursVehicle[] = vehiclesQ.data ?? [];
  const c: EventConcours | null = concoursQ.data ?? null;

  return (
    <div className="space-y-5">
      <div className="rounded-lg border-2 border-primary/40 bg-primary/5 p-3 text-sm text-ink/80">
        <p className="font-bold text-primary">Concours Mini</p>
        <p className="mt-1">
          Fun, light-hearted judging. Members score the full set; public visitors get 50% of the
          questions (weighted half). Questions are randomly balanced across categories.
        </p>
      </div>

      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4"
        />
        <span className="text-sm font-bold">Enable Concours Mini for this event</span>
      </label>

      {enabled && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-ink/70">
                Number of questions (5–15)
              </span>
              <input
                type="number"
                min={5}
                max={15}
                value={questionCount}
                onChange={(e) =>
                  setQuestionCount(Math.max(5, Math.min(15, Number(e.target.value) || 10)))
                }
                className={inp}
              />
            </label>
            <div className="flex items-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => save(true)}
                className="inline-flex items-center gap-1 rounded-md border-2 border-ink bg-paper px-3 py-2 text-xs font-bold uppercase disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Re-roll questions
              </button>
            </div>
          </div>

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-ink/70">
              Prize description (EN)
            </span>
            <input
              value={prizeEn}
              onChange={(e) => setPrizeEn(e.target.value)}
              placeholder="e.g. Bottle of local red + bragging rights"
              className={inp}
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-ink/70">
              Prize description (AF)
            </span>
            <input
              value={prizeAf}
              onChange={(e) => setPrizeAf(e.target.value)}
              placeholder="bv. Bottel plaaslike rooi + spogregte"
              className={inp}
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-ink/70">
              Sponsor name (optional)
            </span>
            <input
              value={sponsorName}
              onChange={(e) => setSponsorName(e.target.value)}
              className={inp}
            />
          </label>

          <ImageUploadField
            label="Sponsor logo (optional)"
            value={sponsorLogoUrl}
            onChange={(v) => setSponsorLogoUrl(v || "")}
            bucket="gallery"
            folder="events/concours-sponsors"
            maxMb={2}
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => save(false)}
              className="rounded-md border-2 border-ink bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-paper disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save Concours settings"}
            </button>
            {c && (
              <button
                type="button"
                disabled={busy}
                onClick={toggleReveal}
                className="inline-flex items-center gap-1 rounded-md border-2 border-ink bg-paper px-4 py-2 text-sm font-bold uppercase tracking-wider disabled:opacity-50"
              >
                {c.leaderboard_revealed ? (
                  <>
                    <EyeOff className="h-4 w-4" /> Hide leaderboard
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4" /> Reveal leaderboard
                  </>
                )}
              </button>
            )}
          </div>
          {msg && <p className="text-sm font-bold text-primary">{msg}</p>}

          {/* Vehicles */}
          <div className="mt-6 border-t-2 border-ink pt-4">
            <h3 className="flex items-center gap-2 font-display text-xl text-ink">
              <Trophy className="h-5 w-5 text-primary" /> Vehicles on the field
            </h3>
            <p className="mt-1 text-xs text-ink/60">
              At least one vehicle photo is required before members can score. Late arrivals can be
              added any time.
            </p>

            {vehicles.length > 0 && (
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {vehicles.map((v) => (
                  <li
                    key={v.id}
                    className="flex gap-3 rounded-lg border-2 border-ink bg-card p-2"
                  >
                    <img
                      src={v.photo_url}
                      alt={v.label ?? ""}
                      className="h-16 w-20 rounded border border-ink object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-ink">
                        {v.label || "Untitled"}
                      </p>
                      <p className="text-xs text-ink/60">
                        {v.submission_count ?? 0} scores
                        {v.average_score != null ? ` · avg ${v.average_score}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteVehicle(v.id)}
                      className="rounded border-2 border-primary bg-primary p-1.5 text-paper"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 space-y-3 rounded-lg border-2 border-dashed border-ink/40 bg-paper p-3">
              <ImageUploadField
                label="Vehicle photo"
                value={photoUrl}
                onChange={(v) => setPhotoUrl(v || "")}
                bucket="gallery"
                folder={`events/concours/${eventId}`}
                maxMb={5}
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-ink/70">
                    Label (EN)
                  </span>
                  <input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g. Red MG B"
                    className={inp}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-ink/70">
                    Label (AF)
                  </span>
                  <input
                    value={labelAf}
                    onChange={(e) => setLabelAf(e.target.value)}
                    className={inp}
                  />
                </label>
              </div>
              <button
                type="button"
                disabled={busy || !photoUrl}
                onClick={handleAddVehicle}
                className="inline-flex items-center gap-1 rounded-md border-2 border-ink bg-paper px-3 py-2 text-xs font-bold uppercase disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" /> Add vehicle
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const inp = "mt-1 w-full rounded-md border-2 border-ink bg-paper px-3 py-2";
