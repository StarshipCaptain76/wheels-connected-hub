import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "jw.installPromptDismissed";

export function InstallPrompt() {
  const { t } = useI18n();
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!visible || !evt) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  const install = async () => {
    await evt.prompt();
    await evt.userChoice.catch(() => null);
    setVisible(false);
    setEvt(null);
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-xl border border-border bg-card p-4 shadow-lg sm:inset-x-auto sm:right-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/15 p-2 text-primary">
          <Download className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">{t("pwa.installTitle")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("pwa.installBody")}</p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={install}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-primary-foreground hover:bg-primary/90"
            >
              {t("pwa.install")}
            </button>
            <button
              onClick={dismiss}
              className="rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
            >
              {t("pwa.later")}
            </button>
          </div>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
