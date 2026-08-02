/** Small "12/120" counter shown under text inputs so users stay within field limits. */
export function CharCounter({ value, max }: { value: string | null | undefined; max: number }) {
  const len = (value ?? "").length;
  const near = len >= max * 0.9;
  return (
    <span
      className={
        "mt-1 block text-right text-[11px] tabular-nums " +
        (len >= max ? "font-bold text-primary" : near ? "text-primary/80" : "text-ink/50")
      }
    >
      {len}/{max}
    </span>
  );
}
