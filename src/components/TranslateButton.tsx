import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { translateText } from "@/lib/translate.functions";
import { Languages, Loader2 } from "lucide-react";

type Props = {
  /** Source text to translate */
  source: string;
  from: "en" | "af";
  to: "en" | "af";
  /** Called with translated text */
  onResult: (text: string) => void;
  /** Optional label override */
  label?: string;
  className?: string;
};

/**
 * Small button that translates `source` from→to and calls onResult.
 * Place next to the target language field.
 */
export function TranslateButton({ source, from, to, onResult, label, className = "" }: Props) {
  const translate = useServerFn(translateText);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const defaultLabel =
    from === "en" && to === "af"
      ? "EN → AF"
      : from === "af" && to === "en"
        ? "AF → EN"
        : `${from.toUpperCase()} → ${to.toUpperCase()}`;

  async function run() {
    const text = source.trim();
    if (!text) {
      setErr("Nothing to translate");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await translate({ data: { text, from, to } });
      onResult(res.text);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Translate failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className={`inline-flex flex-col items-end gap-0.5 ${className}`}>
      <button
        type="button"
        onClick={run}
        disabled={busy || !source.trim()}
        title={label ?? defaultLabel}
        className="inline-flex items-center gap-1 rounded border-2 border-ink bg-paper px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink hover:bg-ink/5 disabled:opacity-40"
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Languages className="h-3 w-3" />}
        {label ?? defaultLabel}
      </button>
      {err && <span className="max-w-[140px] text-right text-[10px] text-primary">{err}</span>}
    </span>
  );
}
