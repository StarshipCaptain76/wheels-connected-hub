import { useState } from "react";
import { KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function ChangePassword({ lang }: { lang: "en" | "af" }) {
  const af = lang === "af";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError(af ? "Wagwoord moet ten minste 8 karakters wees." : "Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError(af ? "Wagwoorde stem nie ooreen nie." : "Passwords do not match.");
      return;
    }
    setStatus("saving");
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setStatus("idle");
      setError(err.message);
      return;
    }
    setStatus("done");
    setPassword("");
    setConfirm("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-2xl border-2 border-ink bg-card p-5 shadow-[4px_4px_0_0_var(--color-ink)]"
    >
      <p className="flex items-center gap-2 font-display text-xs uppercase tracking-[0.2em] text-ink">
        <KeyRound className="h-4 w-4 text-primary" />
        {af ? "Verander wagwoord" : "Change password"}
      </p>
      <div>
        <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink/70">
          {af ? "Nuwe wagwoord" : "New password"}
        </label>
        <input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border-2 border-ink bg-paper px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink/70">
          {af ? "Bevestig wagwoord" : "Confirm password"}
        </label>
        <input
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full rounded-md border-2 border-ink bg-paper px-3 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={status === "saving"}
        className="w-full rounded-md border-2 border-ink bg-ink px-4 py-2 text-xs font-bold uppercase tracking-wider text-paper shadow-[3px_3px_0_0_var(--color-primary)] transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none disabled:opacity-50"
      >
        {status === "saving" ? "…" : af ? "Werk wagwoord by" : "Update password"}
      </button>
      {status === "done" && (
        <p className="text-xs text-primary">
          {af ? "Wagwoord opgedateer." : "Password updated."}
        </p>
      )}
      {error && <p className="text-xs text-primary">{error}</p>}
    </form>
  );
}
