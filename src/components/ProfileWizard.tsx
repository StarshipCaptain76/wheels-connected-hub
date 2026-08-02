import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n/I18nProvider";
import { updateMyProfile, type MemberProfile } from "@/lib/profile.functions";
import { updateMyAvatar } from "@/lib/garage.functions";
import { missingProfileFields, type ProfileFieldKey } from "@/lib/profile-completeness";

function pickImageFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp,image/*";
    input.style.display = "none";
    document.body.appendChild(input);
    input.addEventListener("change", () => {
      const file = input.files?.[0] ?? null;
      document.body.removeChild(input);
      resolve(file);
    });
    input.addEventListener("cancel", () => {
      document.body.removeChild(input);
      resolve(null);
    });
    input.click();
  });
}

async function signedGarageUrl(path: string): Promise<string> {
  const { data: signed } = await supabase.storage
    .from("garage")
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  return signed?.signedUrl ?? "";
}

type Copy = { title: string; help: string; placeholder: string };

const COPY: Record<ProfileFieldKey, { en: Copy; af: Copy }> = {
  display_name: {
    en: {
      title: "What is your name?",
      help: "This is the name other members see on your card and in the club list.",
      placeholder: "e.g. Hugo van Dyk",
    },
    af: {
      title: "Wat is jou naam?",
      help: "Dit is die naam wat ander lede op jou kaart en in die kluglys sien.",
      placeholder: "bv. Hugo van Dyk",
    },
  },
  phone: {
    en: {
      title: "What is your phone number?",
      help: "The club uses this to reach you about events and drives.",
      placeholder: "e.g. 083 686 9237",
    },
    af: {
      title: "Wat is jou foonnommer?",
      help: "Die klub gebruik dit om jou oor geleenthede en ritte te kontak.",
      placeholder: "bv. 083 686 9237",
    },
  },
  town: {
    en: {
      title: "Which town do you live in?",
      help: "Helps members near you plan drives together.",
      placeholder: "e.g. Riversdale",
    },
    af: {
      title: "In watter dorp bly jy?",
      help: "Help lede naby jou om saam ritte te beplan.",
      placeholder: "bv. Riversdal",
    },
  },
  avatar_url: {
    en: {
      title: "Add a profile photo",
      help: "A photo of you, or of you with your car. It appears on your member card.",
      placeholder: "",
    },
    af: {
      title: "Laai 'n profielfoto",
      help: "'n Foto van jou, of van jou met jou motor. Dit verskyn op jou lidkaart.",
      placeholder: "",
    },
  },
  favourite_ride: {
    en: {
      title: "What is your favourite ride?",
      help: "The car, bakkie or bike you love most.",
      placeholder: "e.g. 1967 Ford Cortina",
    },
    af: {
      title: "Wat is jou gunsteling ryding?",
      help: "Die motor, bakkie of fiets waarvan jy die meeste hou.",
      placeholder: "bv. 1967 Ford Cortina",
    },
  },
  featured_bio: {
    en: {
      title: "Tell the club a little about you",
      help: "A few sentences. We use this when you are the featured member on the home page.",
      placeholder: "Tell the club about you, your cars and your stories…",
    },
    af: {
      title: "Vertel die klub 'n bietjie van jou",
      help: "'n Paar sinne. Ons gebruik dit wanneer jy die uitgestalde lid op die tuisblad is.",
      placeholder: "Vertel die klub van jou, jou motors en jou stories…",
    },
  },
};

export function ProfileWizard({
  profile,
  onClose,
}: {
  profile: MemberProfile;
  onClose: () => void;
}) {
  const { lang } = useI18n();
  const qc = useQueryClient();
  const saveProfile = useServerFn(updateMyProfile);
  const saveAvatar = useServerFn(updateMyAvatar);

  // Steps are locked in when the wizard opens so it doesn't jump around while saving.
  const initialMissing = useMemo(() => missingProfileFields(profile), []); // eslint-disable-line react-hooks/exhaustive-deps
  const steps = initialMissing;

  const [index, setIndex] = useState(0);
  const [value, setValue] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatar_url ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(steps.length === 0);

  const key: ProfileFieldKey | undefined = steps[index];
  const af = lang === "af";
  const copy = key ? COPY[key][af ? "af" : "en"] : null;

  useEffect(() => {
    setError(null);
    if (!key || key === "avatar_url") return;
    const current = profile[key];
    setValue(typeof current === "string" ? current : "");
  }, [key, profile]);

  async function handleUpload() {
    setBusy(true);
    setError(null);
    try {
      const file = await pickImageFile();
      if (!file) return;
      if (file.size > 6 * 1024 * 1024) throw new Error(af ? "Maks 6MB" : "Max 6MB");
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      if (!userId) throw new Error(af ? "Nie aangemeld nie" : "Not signed in");
      const ext =
        (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `avatars/${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("garage").upload(path, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type || "image/jpeg",
      });
      if (upErr) throw new Error(upErr.message);
      const url = await signedGarageUrl(path);
      if (!url) {
        throw new Error(af ? "Kon nie die foto se skakel kry nie" : "Could not resolve photo URL");
      }
      await saveAvatar({ data: { avatar_url: url } });
      setAvatarPreview(url);
      await qc.invalidateQueries({ queryKey: ["profile", "me"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function next() {
    if (!key) return;
    setBusy(true);
    setError(null);
    try {
      if (key !== "avatar_url") {
        const trimmed = value.trim();
        if (trimmed) {
          const updated = await saveProfile({ data: { [key]: trimmed } });
          qc.setQueryData(["profile", "me"], updated);
        }
      }
      if (index + 1 >= steps.length) {
        await qc.invalidateQueries({ queryKey: ["profile", "me"] });
        setDone(true);
      } else {
        setIndex((i) => i + 1);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  const canContinue = key === "avatar_url" ? Boolean(avatarPreview) : value.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/70 sm:items-center sm:p-4">
      <div className="w-full max-w-lg rounded-t-2xl border-2 border-ink bg-paper shadow-[6px_6px_0_0_var(--color-primary)] sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 rounded-t-2xl border-b-2 border-ink bg-ink px-5 py-3 text-paper">
          <div>
            <p className="font-display text-[11px] tracking-[0.3em] text-primary">
              {af ? "VOLTOOI JOU PROFIEL" : "COMPLETE YOUR PROFILE"}
            </p>
            <p className="text-sm text-paper/70">
              {done
                ? af
                  ? "Klaar!"
                  : "All done!"
                : `${af ? "Stap" : "Step"} ${index + 1} / ${steps.length}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={af ? "Maak toe" : "Close"}
            className="rounded-md border-2 border-paper/40 p-1 hover:bg-paper/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {done ? (
          <div className="px-6 py-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-ink bg-primary text-paper">
              <Check className="h-7 w-7" />
            </div>
            <h3 className="mt-4 font-display text-2xl tracking-wide text-ink">
              {af ? "Jou profiel lyk great!" : "Your profile looks great!"}
            </h3>
            <p className="mt-2 text-sm text-ink/60">
              {af
                ? "Jy kan enige tyd hieronder verander."
                : "You can change anything below at any time."}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full rounded-md border-2 border-ink bg-primary px-5 py-3 text-sm font-bold uppercase tracking-wider text-paper shadow-[3px_3px_0_0_var(--color-ink)]"
            >
              {af ? "Klaar" : "Done"}
            </button>
          </div>
        ) : (
          <div className="px-5 py-5 sm:px-6">
            <div className="mb-4 flex gap-1.5">
              {steps.map((s, i) => (
                <span
                  key={s}
                  className={`h-1.5 flex-1 rounded-full border border-ink ${
                    i <= index ? "bg-primary" : "bg-paper"
                  }`}
                />
              ))}
            </div>

            <h3 className="font-display text-2xl tracking-wide text-ink">{copy?.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-ink/60">{copy?.help}</p>

            <div className="mt-4">
              {key === "avatar_url" ? (
                <div className="flex items-center gap-4">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-ink bg-ink/5">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleUpload()}
                    className="inline-flex items-center gap-2 rounded-md border-2 border-ink bg-paper px-4 py-2 text-sm font-bold uppercase tracking-wider text-ink shadow-[3px_3px_0_0_var(--color-primary)] disabled:opacity-60"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 text-primary" />
                    )}
                    {avatarPreview
                      ? af
                        ? "Kies 'n ander foto"
                        : "Choose another photo"
                      : af
                        ? "Kies foto"
                        : "Choose photo"}
                  </button>
                </div>
              ) : key === "featured_bio" ? (
                <>
                  <textarea
                    rows={5}
                    maxLength={600}
                    value={value}
                    placeholder={copy?.placeholder}
                    onChange={(e) => setValue(e.target.value.slice(0, 600))}
                    className="w-full rounded-md border-2 border-ink bg-paper px-3 py-2 text-sm leading-relaxed"
                  />
                  <p className="mt-1 text-right text-[11px] text-ink/45">{value.length}/600</p>
                </>
              ) : (
                <input
                  type={key === "phone" ? "tel" : "text"}
                  value={value}
                  placeholder={copy?.placeholder}
                  onChange={(e) => setValue(e.target.value)}
                  className="w-full rounded-md border-2 border-ink bg-paper px-3 py-2.5 text-base"
                />
              )}
            </div>

            {error && (
              <p className="mt-3 rounded-md border-2 border-primary bg-primary/10 px-3 py-2 text-sm text-ink">
                {error}
              </p>
            )}

            <div className="mt-5 flex items-center gap-3">
              {index > 0 && (
                <button
                  type="button"
                  onClick={() => setIndex((i) => i - 1)}
                  className="rounded-md border-2 border-ink bg-paper px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-ink"
                >
                  {af ? "Terug" : "Back"}
                </button>
              )}
              <button
                type="button"
                disabled={busy || !canContinue}
                onClick={() => void next()}
                className="flex-1 rounded-md border-2 border-ink bg-primary px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-paper shadow-[3px_3px_0_0_var(--color-ink)] disabled:opacity-50"
              >
                {busy
                  ? af
                    ? "Stoor…"
                    : "Saving…"
                  : index + 1 >= steps.length
                    ? af
                      ? "Klaar"
                      : "Finish"
                    : af
                      ? "Volgende"
                      : "Next"}
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full text-center text-xs font-bold uppercase tracking-wider text-ink/45 underline"
            >
              {af ? "Slaan vir eers oor" : "Skip for now"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
