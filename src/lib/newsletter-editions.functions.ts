import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ADMIN_EMAIL = "admin@justwheels.co.za";
const FROM = "Just Wheels <news@notify.justwheels.co.za>";
const SITE_URL = "https://justwheels.co.za";
const BUCKET = "newsletters";

export type NewsletterEdition = {
  id: string;
  year: number;
  month: number;
  title_en: string;
  title_af: string;
  body_en: string;
  body_af: string;
  admin_notes: string | null;
  pdf_path: string | null;
  pdf_path_af: string | null;
  status: "draft" | "sent" | "published";
  is_published: boolean;
  sent_at: string | null;
  sent_count: number;
  published_at: string | null;
  created_at: string;
};

const SELECT =
  "id, year, month, title_en, title_af, body_en, body_af, admin_notes, pdf_path, pdf_path_af, status, is_published, sent_at, sent_count, published_at, created_at";

/* ------------------------------------------------------------------ */
/* Public reads                                                        */
/* ------------------------------------------------------------------ */

export const listPublishedEditions = createServerFn({ method: "GET" }).handler(
  async (): Promise<NewsletterEdition[]> => {
    const { createPublicSupabase } = await import("./public-supabase.server");
    const anon = createPublicSupabase();
    const { data, error } = await anon
      .from("newsletter_editions")
      .select(SELECT)
      .eq("is_published", true)
      .order("year", { ascending: false })
      .order("month", { ascending: false })
      .limit(24);
    if (error) {
      console.error("[newsletter-editions] public list failed", error.message);
      return [];
    }
    return (data ?? []) as NewsletterEdition[];
  },
);

/* ------------------------------------------------------------------ */
/* Admin helpers                                                       */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}


export const listEditions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NewsletterEdition[]> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data, error } = await supabase
      .from("newsletter_editions")
      .select(SELECT)
      .order("year", { ascending: false })
      .order("month", { ascending: false });
    if (error) throw error;
    return (data ?? []) as NewsletterEdition[];
  });

const saveSchema = z.object({
  id: z.string().uuid().optional(),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  titleEn: z.string().trim().max(200).default(""),
  titleAf: z.string().trim().max(200).default(""),
  bodyEn: z.string().trim().max(30000).default(""),
  bodyAf: z.string().trim().max(30000).default(""),
  adminNotes: z.string().trim().max(8000).optional().default(""),
  isPublished: z.boolean().optional(),
  /** base64 (no data: prefix) of a newly uploaded PDF */
  pdfBase64: z.string().max(14_000_000).optional(),
  pdfName: z.string().max(200).optional(),
  /** base64 (no data: prefix) of a newly uploaded Afrikaans PDF */
  pdfAfBase64: z.string().max(14_000_000).optional(),
  pdfAfName: z.string().max(200).optional(),
});

export const saveEdition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => saveSchema.parse(i))
  .handler(async ({ context, data }): Promise<{ id: string }> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    async function uploadPdf(b64: string, name: string | undefined, tag: string) {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const safeName = (name ?? "newsletter.pdf").replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${data.year}-${String(data.month).padStart(2, "0")}/${tag}-${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType: "application/pdf", upsert: true });
      if (upErr) throw new Error(`PDF upload failed: ${upErr.message}`);
      return path;
    }

    let pdfPath: string | undefined;
    if (data.pdfBase64) pdfPath = await uploadPdf(data.pdfBase64, data.pdfName, "en");
    let pdfPathAf: string | undefined;
    if (data.pdfAfBase64) pdfPathAf = await uploadPdf(data.pdfAfBase64, data.pdfAfName, "af");

    const row = {
      year: data.year,
      month: data.month,
      title_en: data.titleEn,
      title_af: data.titleAf,
      body_en: data.bodyEn,
      body_af: data.bodyAf,
      admin_notes: data.adminNotes || null,
      ...(pdfPath ? { pdf_path: pdfPath } : {}),
      ...(pdfPathAf ? { pdf_path_af: pdfPathAf } : {}),
      ...(data.isPublished === undefined
        ? {}
        : {
            is_published: data.isPublished,
            published_at: data.isPublished ? new Date().toISOString() : null,
          }),
    };

    if (data.id) {
      const { error } = await supabase
        .from("newsletter_editions")
        .update(row)
        .eq("id", data.id);
      if (error) throw error;
      return { id: data.id };
    }

    const { data: inserted, error } = await supabase
      .from("newsletter_editions")
      .insert({ ...row, created_by: userId })
      .select("id")
      .single();
    if (error) throw error;
    return { id: (inserted as { id: string }).id };
  });

export const deleteEdition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase.from("newsletter_editions").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true as const };
  });

/* ------------------------------------------------------------------ */
/* AI drafting                                                         */
/* ------------------------------------------------------------------ */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const draftEdition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(
    async ({
      context,
      data,
    }): Promise<{ titleEn: string; titleAf: string; bodyEn: string; bodyAf: string }> => {
      const { supabase, userId } = context;
      await assertAdmin(supabase, userId);

      const { data: ed, error } = await supabase
        .from("newsletter_editions")
        .select(SELECT)
        .eq("id", data.id)
        .single();
      if (error || !ed) throw new Error("Edition not found");
      const edition = ed as NewsletterEdition;
      const sourcePath = edition.pdf_path ?? edition.pdf_path_af;
      if (!sourcePath) throw new Error("Upload the newsletter PDF first.");

      const { data: file, error: dlErr } = await supabase.storage
        .from(BUCKET)
        .download(sourcePath);
      if (dlErr || !file) throw new Error("Could not read the uploaded PDF.");
      const buf = new Uint8Array(await (file as Blob).arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i += 8192) {
        bin += String.fromCharCode(...buf.subarray(i, i + 8192));
      }
      const b64 = btoa(bin);

      const key = process.env["LOVABLE_API_KEY"];
      if (!key) throw new Error("AI is not configured.");

      const monthLabel = `${MONTHS[edition.month - 1]} ${edition.year}`;
      const system = [
        "You write the monthly email for Just Wheels Hessequa, a friendly Southern Cape car club in South Africa.",
        "Voice: warm, funny, a bit petrolhead, plain language that suits older members too.",
        "It is written by 'the Chief Mechanic and his crew' and addressed to club members and anyone who finds wheels interesting.",
        "Read the attached club newsletter PDF and write an email that teases the highlights and invites people to open the attached PDF.",
        "Keep it to roughly 200-320 words. Simple HTML only: <p>, <strong>, <em>, <ul>, <li>. No headings, no images, no links, no unsubscribe text.",
        "Return STRICT JSON only, no code fences:",
        '{"title_en":"","title_af":"","body_en":"","body_af":""}',
        "title_* are email subject lines (max 90 chars) mentioning " + monthLabel + ".",
        "body_af is a natural Afrikaans version of body_en (not a stiff literal translation).",
      ].join("\n");

      const userParts: unknown[] = [
        {
          type: "text",
          text:
            `Edition: ${monthLabel}.` +
            (edition.admin_notes
              ? `\n\nExtra content, context and instructions from the club admin (follow these closely):\n${edition.admin_notes}`
              : ""),
        },
        {
          type: "file",
          file: {
            filename: `${monthLabel}.pdf`,
            file_data: `data:application/pdf;base64,${b64}`,
          },
        },
      ];

      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: system },
            { role: "user", content: userParts },
          ],
          temperature: 0.8,
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        console.error(`[newsletter-ai] ${res.status}: ${body}`);
        if (res.status === 429) throw new Error("AI is busy right now — try again in a minute.");
        if (res.status === 402) throw new Error("AI credits are depleted.");
        throw new Error("AI draft failed. Try again.");
      }

      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const raw = json.choices?.[0]?.message?.content?.trim() ?? "";
      const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      let parsed: Record<string, string>;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        const m = cleaned.match(/\{[\s\S]*\}/);
        if (!m) throw new Error("AI returned an unexpected response. Try again.");
        parsed = JSON.parse(m[0]);
      }

      return {
        titleEn: (parsed["title_en"] ?? "").slice(0, 200),
        titleAf: (parsed["title_af"] ?? "").slice(0, 200),
        bodyEn: parsed["body_en"] ?? "",
        bodyAf: parsed["body_af"] ?? "",
      };
    },
  );

/* ------------------------------------------------------------------ */
/* Sending                                                             */
/* ------------------------------------------------------------------ */

function shell(bodyHtml: string, unsubUrl: string, isAf: boolean, monthLabel: string) {
  return `
    <div style="font-family:Arial,sans-serif;color:#111;max-width:600px;margin:0 auto">
      <div style="background:#c1121f;color:#fff;padding:16px 20px;border-radius:6px 6px 0 0">
        <div style="font-size:22px;letter-spacing:2px;font-weight:bold">JUST WHEELS HESSEQUA</div>
        <div style="font-size:13px;opacity:.9">${monthLabel} ${isAf ? "nuusbrief" : "newsletter"}</div>
      </div>
      <div style="padding:20px;background:#fff;border:1px solid #eee;border-top:none;border-radius:0 0 6px 6px">
        ${bodyHtml}
        <p style="margin:24px 0 0;font-size:13px;color:#555">
          ${isAf ? "Die volledige nuusbrief is aangeheg as PDF." : "The full newsletter is attached as a PDF."}
        </p>
        <p style="margin:16px 0 0;font-size:13px;color:#555">
          ${isAf ? "Groete, die Hoofwerktuigkundige en sy span" : "Cheers, the Chief Mechanic and his crew"}
        </p>
      </div>
      <p style="font-size:12px;color:#666;text-align:center;margin-top:16px">
        <a href="${unsubUrl}" style="color:#666">${isAf ? "Kanselleer intekening" : "Unsubscribe"}</a>
      </p>
    </div>`;
}

export const sendEdition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        testOnly: z.boolean().default(false),
        includeMembers: z.boolean().default(false),
      })
      .parse(i),
  )

  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { data: ed, error } = await supabase
      .from("newsletter_editions")
      .select(SELECT)
      .eq("id", data.id)
      .single();
    if (error || !ed) throw new Error("Edition not found");
    const edition = ed as NewsletterEdition;
    if (!edition.body_en.trim()) throw new Error("Write or draft the email body first.");

    const key = process.env["RESEND_API_KEY"];
    if (!key) throw new Error("Email is not configured.");

    const monthLabel = `${MONTHS[edition.month - 1]} ${edition.year}`;

    type Attachment = { filename: string; content: string };
    async function loadPdf(path: string | null, suffix: string): Promise<Attachment | null> {
      if (!path) return null;
      const { data: file } = await supabase.storage.from(BUCKET).download(path);
      if (!file) return null;
      const buf = new Uint8Array(await (file as Blob).arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i += 8192) {
        bin += String.fromCharCode(...buf.subarray(i, i + 8192));
      }
      return {
        filename: `Just-Wheels-${monthLabel.replace(" ", "-")}${suffix}.pdf`,
        content: btoa(bin),
      };
    }

    const attachmentEn = await loadPdf(edition.pdf_path, "");
    const attachmentAf = await loadPdf(edition.pdf_path_af, "-AF");

    async function send(to: string, subject: string, html: string, isAf = false) {
      const attachment = (isAf ? (attachmentAf ?? attachmentEn) : attachmentEn) ?? null;
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          from: FROM,
          to: [to],
          subject,
          html,
          ...(attachment ? { attachments: [attachment] } : {}),
        }),
      });
      if (!res.ok) throw new Error(`Email send failed (${res.status}): ${await res.text()}`);
    }

    if (data.testOnly) {
      const unsubUrl = `${SITE_URL}/api/public/newsletter/unsubscribe?token=preview`;
      await send(
        ADMIN_EMAIL,
        `[TEST] ${edition.title_en || monthLabel}`,
        shell(edition.body_en, unsubUrl, false, monthLabel),
      );
      return { ok: true as const, sent: 1, failed: 0, test: true };
    }

    const { data: subs, error: subErr } = await supabase
      .from("newsletter_subscribers")
      .select("email, lang, unsubscribe_token, unsubscribed_at");
    if (subErr) throw subErr;
    const active = (subs ?? []).filter((s) => !s.unsubscribed_at);

    let sent = 0;
    let failed = 0;
    for (const s of active) {
      const isAf = s.lang === "af";
      const subject =
        (isAf && edition.title_af ? edition.title_af : edition.title_en) || monthLabel;
      const body = isAf && edition.body_af ? edition.body_af : edition.body_en;
      const unsubUrl = `${SITE_URL}/api/public/newsletter/unsubscribe?token=${s.unsubscribe_token}`;
      try {
        await send(s.email, subject, shell(body, unsubUrl, isAf, monthLabel), isAf);
        sent++;
        await new Promise((r) => setTimeout(r, 120));
      } catch (e) {
        failed++;
        console.error(`[newsletter-edition] send to ${s.email} failed`, e);
      }
    }

    await supabase
      .from("newsletter_editions")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        sent_count: sent,
      })
      .eq("id", edition.id);

    if (sent > 0) {
      try {
        const { fanOut } = await import("./notify.server");
        await fanOut(
          {
            type: "new_newsletter",
            title_en: `${monthLabel} newsletter is out`,
            title_af: `${monthLabel} nuusbrief is uit`,
            body_en: edition.title_en,
            body_af: edition.title_af || edition.title_en,
            link: "/",
          },
          supabase,
        );
      } catch (e) {
        console.error("[newsletter-edition] notify failed", e);
      }
    }

    return { ok: true as const, sent, failed, test: false };
  });
