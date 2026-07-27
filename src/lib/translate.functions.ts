import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  text: z.string().trim().min(1).max(4000),
  from: z.enum(["en", "af"]),
  to: z.enum(["en", "af"]),
});

/**
 * Translate EN ↔ AF.
 * Prefer Lovable AI gateway when configured; fall back to MyMemory free API.
 */
export const translateText = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => inputSchema.parse(i))
  .handler(async ({ data }): Promise<{ text: string }> => {
    if (data.from === data.to) return { text: data.text };

    // 1) Lovable AI gateway (if key present)
    const lovableKey = process.env.LOVABLE_API_KEY;
    if (lovableKey) {
      try {
        const fromLabel = data.from === "en" ? "English" : "Afrikaans";
        const toLabel = data.to === "en" ? "English" : "Afrikaans";
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content:
                  `You are a precise translator for a South African car club website. Translate from ${fromLabel} to ${toLabel}. Return ONLY the translated text, no quotes, no commentary. Keep tone natural for club members. Preserve names, numbers, and model names.`,
              },
              { role: "user", content: data.text },
            ],
            temperature: 0.2,
          }),
        });
        if (res.ok) {
          const json = (await res.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          const out = json.choices?.[0]?.message?.content?.trim();
          if (out) return { text: out };
        }
      } catch {
        // fall through
      }
    }

    // 2) MyMemory free API fallback
    const url =
      "https://api.mymemory.translated.net/get?q=" +
      encodeURIComponent(data.text.slice(0, 500)) +
      `&langpair=${data.from}|${data.to}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Translate failed (${res.status})`);
    const json = (await res.json()) as {
      responseData?: { translatedText?: string };
      responseStatus?: number;
    };
    const out = json.responseData?.translatedText?.trim();
    if (!out) throw new Error("No translation returned");
    // MyMemory sometimes returns the same text or quota messages
    if (/MYMEMORY WARNING/i.test(out)) {
      throw new Error("Translation quota reached — try again later");
    }
    return { text: out };
  });
