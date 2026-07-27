import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useI18n } from "@/i18n/I18nProvider";
import { subscribeNewsletter } from "@/lib/newsletter.functions";
import { Mail } from "lucide-react";

export function NewsletterSignup() {
  const { t, lang } = useI18n();
  const subscribeFn = useServerFn(subscribeNewsletter);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setState("sending");
    setErrorMsg("");
    try {
      await subscribeFn({ data: { email: email.trim(), lang, source: "footer" } });
      setState("sent");
      setEmail("");
    } catch (err) {
      setState("error");
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="mb-3 font-display text-sm tracking-widest text-primary">
        {t("newsletter.title")}
      </div>
      <p className="text-sm text-paper/70">{t("newsletter.blurb")}</p>
      {state === "sent" ? (
        <p className="rounded-md border-2 border-primary bg-primary/10 px-3 py-2 text-sm text-paper">
          {t("newsletter.sent")}
        </p>
      ) : (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("newsletter.placeholder")}
              className="w-full rounded-md border-2 border-paper bg-paper py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            type="submit"
            disabled={state === "sending"}
            className="rounded-md border-2 border-primary bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-paper transition-transform hover:translate-y-0.5 disabled:opacity-60"
          >
            {state === "sending" ? t("newsletter.sending") : t("newsletter.subscribe")}
          </button>
        </div>
      )}
      {state === "error" && (
        <p className="text-xs text-primary">{errorMsg || t("newsletter.error")}</p>
      )}
    </form>
  );
}
