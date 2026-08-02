/** Building blocks for short, screenshot-led admin instruction emails. */
import { escapeHtml, SITE_ORIGIN } from "./email.server";

export const SHOT_BASE = SITE_ORIGIN + "/email/";

/** A numbered step: one short line + a tappable real screenshot. */
export function shot(n: number, line: string, image: string, linkUrl: string): string {
  const src = SHOT_BASE + image;
  return (
    '<div style="margin:0 0 22px">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 8px">' +
    "<tr>" +
    '<td style="width:30px;vertical-align:top">' +
    '<span style="display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;' +
    'background:#c8102e;color:#fff;border-radius:50%;font-weight:bold;font-size:14px">' +
    String(n) +
    "</span></td>" +
    '<td style="font-size:16px;line-height:1.4;font-weight:bold;color:#111">' +
    line +
    "</td></tr></table>" +
    '<a href="' +
    linkUrl +
    '" style="display:block;text-decoration:none">' +
    '<img src="' +
    src +
    '" width="390" alt="' +
    escapeHtml(stripTags(line)) +
    '" style="display:block;width:100%;max-width:390px;height:auto;border:2px solid #111;border-radius:8px" />' +
    "</a>" +
    "</div>"
  );
}

/** A numbered step without a screenshot. */
export function textStep(n: number, line: string): string {
  return (
    '<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 22px">' +
    "<tr>" +
    '<td style="width:30px;vertical-align:top">' +
    '<span style="display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;' +
    'background:#c8102e;color:#fff;border-radius:50%;font-weight:bold;font-size:14px">' +
    String(n) +
    "</span></td>" +
    '<td style="font-size:16px;line-height:1.4;font-weight:bold;color:#111">' +
    line +
    "</td></tr></table>"
  );
}

export function bigButton(label: string, url: string): string {
  return (
    '<a href="' +
    url +
    '" style="display:inline-block;background:#111;color:#fff;text-decoration:none;' +
    'border:2px solid #111;border-radius:8px;padding:14px 20px;font-weight:bold;font-size:16px">' +
    escapeHtml(label) +
    "</a>"
  );
}

export function detailBox(rows: Array<[string, string]>): string {
  return (
    '<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;' +
    'background:#f4f1ea;border:2px solid #111;border-radius:8px;padding:0;margin:0 0 22px;width:100%">' +
    "<tr><td style=\"padding:12px 14px\">" +
    '<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:15px">' +
    rows
      .map(
        ([label, value]) =>
          '<tr><td style="padding:3px 12px 3px 0;color:#666">' +
          escapeHtml(label) +
          '</td><td style="padding:3px 0;font-weight:bold;color:#111">' +
          value +
          "</td></tr>",
      )
      .join("") +
    "</table></td></tr></table>"
  );
}

/** Outer frame: red header, white body, tiny footer. */
export function shotShell(kicker: string, title: string, bodyHtml: string): string {
  return (
    '<div style="font-family:Arial,Helvetica,sans-serif;color:#111;max-width:430px;margin:0 auto">' +
    '<div style="background:#c8102e;color:#fff;padding:16px 18px;border-radius:12px 12px 0 0">' +
    '<div style="font-size:12px;letter-spacing:3px">' +
    escapeHtml(kicker) +
    "</div>" +
    '<div style="font-size:21px;font-weight:bold;margin-top:4px;line-height:1.3">' +
    escapeHtml(title) +
    "</div></div>" +
    '<div style="border:2px solid #111;border-top:none;border-radius:0 0 12px 12px;padding:18px">' +
    bodyHtml +
    '<p style="margin:22px 0 0;font-size:12px;color:#888">Just Wheels Hessequa · automatic message</p>' +
    "</div></div>"
  );
}

export function linkFallback(url: string): string {
  return (
    '<p style="margin:10px 0 0;font-size:13px;color:#555;word-break:break-all">' +
    "Or copy this into your browser:<br>" +
    '<a href="' +
    url +
    '" style="color:#c8102e">' +
    escapeHtml(url) +
    "</a></p>"
  );
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}
