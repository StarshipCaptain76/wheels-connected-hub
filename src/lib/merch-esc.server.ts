const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function esc(v: string) {
  return v.replace(/[&<>"']/g, (c) => HTML_ESCAPE_MAP[c] ?? c);
}
