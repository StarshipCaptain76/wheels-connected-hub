/** Event invite email HTML — server only. */
import { escapeHtml, SITE_ORIGIN } from "./email.server";

export type InviteEventData = {
  id: string;
  title: string;
  title_af: string | null;
  description: string | null;
  description_af: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  cover_url: string | null;
  hero_image_url: string | null;
  destination_lat: number | null;
  destination_lng: number | null;
  destination_address: string | null;
  waypoints: Array<{ label: string; label_af: string | null; lat: number | null; lng: number | null; meet_time: string | null }>;
};

function fmtDate(iso: string, lang: "en" | "af"): string {
  try {
    return new Intl.DateTimeFormat(lang === "af" ? "af-ZA" : "en-ZA", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Africa/Johannesburg",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function staticMapUrl(ev: InviteEventData, key: string | undefined): string | null {
  if (!key || ev.destination_lat == null || ev.destination_lng == null) return null;
  const params = new URLSearchParams({
    size: "600x300",
    scale: "2",
    maptype: "roadmap",
    key,
  });
  let url = "https://maps.googleapis.com/maps/api/staticmap?" + params.toString();
  url += `&markers=color:red%7Clabel:D%7C${ev.destination_lat},${ev.destination_lng}`;
  ev.waypoints.forEach((w, i) => {
    if (w.lat != null && w.lng != null) {
      url += `&markers=color:black%7Clabel:${i + 1}%7C${w.lat},${w.lng}`;
    }
  });
  return url;
}

function btn(href: string, label: string, bg: string, color: string): string {
  return (
    `<a href="${href}" style="display:block;background:${bg};color:${color};border:2px solid #111;` +
    `border-radius:8px;padding:14px 18px;margin:0 0 10px;text-align:center;text-decoration:none;` +
    `font-weight:bold;font-size:17px;letter-spacing:1px;text-transform:uppercase">${escapeHtml(label)}</a>`
  );
}

export function buildInviteEmail(input: {
  ev: InviteEventData;
  token: string;
  lang: "en" | "af";
  mapsKey?: string | undefined;
  memberName?: string | null;
}): { subject: string; html: string } {
  const { ev, token, lang } = input;
  const af = lang === "af";
  const title = (af ? ev.title_af : ev.title) || ev.title;
  const desc = (af ? ev.description_af : ev.description) || ev.description || "";
  const eventUrl = `${SITE_ORIGIN}/events/${ev.id}`;
  const rsvp = (r: string) => `${SITE_ORIGIN}/api/public/event-rsvp?token=${token}&r=${r}`;
  const map = staticMapUrl(ev, input.mapsKey);
  const hero = ev.hero_image_url || ev.cover_url;

  const t = af
    ? {
        greet: "Hallo",
        invited: "Jy is genooi na 'n Just Wheels rit",
        when: "Wanneer",
        where: "Waar",
        stops: "Ontmoetplekke",
        going: "Ek gaan",
        maybe: "Miskien",
        no: "Kan nie",
        vote: "Laat weet ons of jy saamry — druk net een knoppie:",
        full: "Sien volle besonderhede & roete",
        foot: "Just Wheels Hessequa",
      }
    : {
        greet: "Hi",
        invited: "You're invited to a Just Wheels run",
        when: "When",
        where: "Where",
        stops: "Meet-up stops",
        going: "I'm going",
        maybe: "Maybe",
        no: "Can't make it",
        vote: "Let us know if you're coming — just tap one button:",
        full: "See full details & route",
        foot: "Just Wheels Hessequa",
      };

  const stopsHtml = ev.waypoints.length
    ? `<h3 style="margin:24px 0 8px;font-size:15px;text-transform:uppercase;letter-spacing:1px">${t.stops}</h3>
       <ol style="margin:0 0 8px;padding-left:20px;color:#333;font-size:15px;line-height:1.6">` +
      ev.waypoints
        .map(
          (w) =>
            `<li>${escapeHtml((af ? w.label_af : w.label) || w.label)}${
              w.meet_time ? " — " + escapeHtml(w.meet_time) : ""
            }</li>`,
        )
        .join("") +
      "</ol>"
    : "";

  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;background:#f5f1e8;padding:16px">` +
    `<div style="max-width:560px;margin:0 auto;background:#fff;border:2px solid #111;border-radius:10px;overflow:hidden">` +
    `<div style="background:#c1121f;color:#fff;padding:14px 20px;font-weight:bold;letter-spacing:2px;text-transform:uppercase">Just Wheels Hessequa</div>` +
    (hero
      ? `<a href="${eventUrl}"><img src="${escapeHtml(hero)}" alt="" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0"/></a>`
      : "") +
    `<div style="padding:20px">` +
    `<p style="margin:0 0 6px;color:#666;font-size:13px;text-transform:uppercase;letter-spacing:1px">${t.invited}</p>` +
    `<h1 style="margin:0 0 14px;font-size:24px;color:#111">${escapeHtml(title)}</h1>` +
    `<p style="margin:0 0 6px;font-size:16px;color:#111"><strong>${t.when}:</strong> ${escapeHtml(fmtDate(ev.starts_at, lang))}</p>` +
    (ev.location || ev.destination_address
      ? `<p style="margin:0 0 14px;font-size:16px;color:#111"><strong>${t.where}:</strong> ${escapeHtml(
          ev.location || ev.destination_address || "",
        )}</p>`
      : "") +
    (desc
      ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#333">${escapeHtml(desc)}</p>`
      : "") +
    (map
      ? `<a href="${eventUrl}"><img src="${map}" alt="Map" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:2px solid #111;border-radius:8px"/></a>`
      : "") +
    stopsHtml +
    `<p style="margin:22px 0 12px;font-size:15px;color:#111">${t.vote}</p>` +
    btn(rsvp("going"), t.going, "#c1121f", "#ffffff") +
    btn(rsvp("maybe"), t.maybe, "#f5f1e8", "#111111") +
    btn(rsvp("not_going"), t.no, "#ffffff", "#111111") +
    `<p style="margin:20px 0 0;text-align:center"><a href="${eventUrl}" style="color:#c1121f;font-weight:bold">${t.full}</a></p>` +
    `<p style="margin:24px 0 0;font-size:12px;color:#888">${t.foot}</p>` +
    `</div></div></div>`;

  const subject = (af ? "Uitnodiging: " : "Invite: ") + title;
  return { subject, html };
}
