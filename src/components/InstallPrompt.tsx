import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const SNOOZE_KEY = "jw.installPromptSnoozedUntil";
const LEGACY_KEY = "jw.installPromptDismissed";
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

export const INSTALL_PROMPT_OPEN_EVENT = "jw:open-install-prompt";

/** Inline head script: captures beforeinstallprompt before React hydrates. */
export const INSTALL_CAPTURE_SCRIPT = `(function(){try{window.__jwInstallEvent=null;window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__jwInstallEvent=e;window.dispatchEvent(new Event('jw:installavailable'));});window.addEventListener('appinstalled',function(){window.__jwInstallEvent=null;});}catch(e){}})();`;

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const webkit = /WebKit/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return iOS && webkit;
}

function snoozed(): boolean {
  try {
    // One-time migration: old permanent dismissals get another chance.
    if (localStorage.getItem(LEGACY_KEY)) localStorage.removeItem(LEGACY_KEY);
    const until = Number(localStorage.getItem(SNOOZE_KEY) || 0);
    return Number.isFinite(until) && Date.now() < until;
  } catch {
    return false;
  }
}

export function InstallPrompt() {
  const { t } = useI18n();
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;

    const w = window as unknown as { __jwInstallEvent?: BeforeInstallPromptEvent | null };

    const show = (force: boolean) => {
      if (isStandalone()) return;
      const captured = w.__jwInstallEvent ?? null;
      if (captured) {
        setEvt(captured);
        setIos(false);
      } else if (isIosSafari()) {
        setIos(true);
      } else if (!force) {
        return;
      } else {
        // No install path available in this browser.
        return;
      }
      if (force || !snoozed()) setVisible(true);
    };

    show(false);

    const onAvailable = () => show(false);
    const onManual = () => show(true);
    const onInstalled = () => setVisible(false);

    window.addEventListener("jw:installavailable", onAvailable);
    window.addEventListener("beforeinstallprompt", onAvailable);
    window.addEventListener(INSTALL_PROMPT_OPEN_EVENT, onManual);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("jw:installavailable", onAvailable);
      window.removeEventListener("beforeinstallprompt", onAvailable);
      window.removeEventListener(INSTALL_PROMPT_OPEN_EVENT, onManual);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!visible || (!evt && !ios)) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
    } catch {
      // ignore
    }
    setVisible(false);
  };

  const install = async () => {
    if (!evt) return;
    await evt.prompt();
    await evt.userChoice.catch(() => null);
    (window as unknown as { __jwInstallEvent?: unknown }).__jwInstallEvent = null;
    setVisible(false);
    setEvt(null);
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-xl border border-border bg-card p-4 shadow-lg sm:inset-x-auto sm:right-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/15 p-2 text-primary">
          {ios ? <Share className="h-5 w-5" /> : <Download className="h-5 w-5" />}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">{t("pwa.installTitle")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {ios ? t("pwa.installIos") : t("pwa.installBody")}
          </p>
          <div className="mt-3 flex gap-2">
            {!ios && (
              <button
                onClick={install}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-primary-foreground hover:bg-primary/90"
              >
                {t("pwa.install")}
              </button>
            )}
            <button
              onClick={dismiss}
              className="rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
            >
              {ios ? t("pwa.gotIt") : t("pwa.later")}
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
