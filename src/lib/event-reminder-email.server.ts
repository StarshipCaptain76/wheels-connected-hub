/** Day-before event reminder email — server only. */
import { escapeHtml, SITE_ORIGIN } from "./email.server";

export type ReminderEvent = {
  id: string;
  title: string;
  title_af: string | null;
  location: string | null;
  starts_at: string;
};

function fmt(iso: string, lang: "en" | "af"): string {
  try {
    return new Intl.DateTimeFormat(lang === "af" ? "af-ZA" : "en-ZA", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Africa/Johannesburg",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function buildReminderEmail(input: {
  ev: ReminderEvent;
  lang: "en" | "af";
  memberName?: string | null;
}): { subject: string; html: string } {
  const { ev, lang } = input;
  const af = lang === "af";
  const title = (af ? ev.title_af : ev.title) || ev.title;
  const when = fmt(ev.starts_at, lang);
  const eventUrl = `${SITE_ORIGIN}/events/${ev.id}`;
  const mapsUrl = ev.location
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.location)}`
    : null;

  const t = af
    ? {
        subject: `Môre: ${title}`,
        hi: input.memberName ? `Haai ${input.memberName},` : "Haai daar,",
        lead: "Net 'n vinnige klop aan die kap — dis môre!",
        whenLbl: "Wanneer",
        whereLbl: "Waar",
        cta: "Sien die byeenkoms",
        directions: "Kry aanwysings",
        checklist: "Tenk vol, bande gepomp, lappie in die kattebak. Sien jou daar!",
        sign: "Die Hoofwerktuigkundige en sy span",
      }
    : {
        subject: `Tomorrow: ${title}`,
        hi: input.memberName ? `Hi ${input.memberName},` : "Hi there,",
        lead: "Quick knock on the bonnet — this one is tomorrow!",
        whenLbl: "When",
        whereLbl: "Where",
        cta: "See the event",
        directions: "Get directions",
        checklist: "Tank full, tyres pumped, cloth in the boot. See you there!",
        sign: "The Chief Mechanic and his crew",
      };

  const btn = (href: string, label: string, bg: string, color: string) =>
    `<a href="${href}" style="display:inline-block;background:${bg};color:${color};border:2px solid #111;` +
    `border-radius:8px;padding:12px 20px;margin:0 8px 10px 0;text-decoration:none;font-weight:bold;` +
    `font-size:15px;letter-spacing:1px;text-transform:uppercase">${escapeHtml(label)}</a>`;

  const html =
    '<div style="font-family:Arial,sans-serif;color:#111;max-width:560px">' +
    `<p style="margin:0 0 8px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#c1121f">${escapeHtml(
      af ? "Herinnering" : "Reminder",
    )}</p>` +
    `<h2 style="margin:0 0 12px;font-size:24px">${escapeHtml(title)}</h2>` +
    `<p style="margin:0 0 6px">${escapeHtml(t.hi)}</p>` +
    `<p style="margin:0 0 16px">${escapeHtml(t.lead)}</p>` +
    `<p style="margin:0 0 6px"><strong>${escapeHtml(t.whenLbl)}:</strong> ${escapeHtml(when)}</p>` +
    (ev.location
      ? `<p style="margin:0 0 16px"><strong>${escapeHtml(t.whereLbl)}:</strong> ${escapeHtml(ev.location)}</p>`
      : "") +
    btn(eventUrl, t.cta, "#c1121f", "#fff") +
    (mapsUrl ? btn(mapsUrl, t.directions, "#fff", "#111") : "") +
    `<p style="margin:16px 0 0">${escapeHtml(t.checklist)}</p>` +
    `<p style="margin:20px 0 0;font-weight:bold">${escapeHtml(t.sign)}</p>` +
    '<p style="margin:24px 0 0;font-size:12px;color:#888">Just Wheels Hessequa</p>' +
    "</div>";

  return { subject: t.subject, html };
}
