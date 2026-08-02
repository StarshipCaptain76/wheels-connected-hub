/** Shared building blocks for plain-language, illustrated instruction emails. */
import { escapeHtml } from "./email.server";

export function stepImage(caption: string, inner: string): string {
  return (
    '<div style="border:2px solid #111;border-radius:10px;overflow:hidden;margin:8px 0 18px">' +
    '<div style="background:#f4f1ea;padding:14px">' +
    inner +
    "</div>" +
    '<div style="background:#111;color:#fff;font-size:12px;padding:6px 10px">' +
    escapeHtml(caption) +
    "</div>" +
    "</div>"
  );
}

export function fakeButton(label: string, bg: string): string {
  return (
    '<span style="display:inline-block;background:' +
    bg +
    ';color:#fff;border:2px solid #111;border-radius:8px;padding:8px 14px;' +
    'font-weight:bold;font-size:13px;letter-spacing:1px">' +
    escapeHtml(label) +
    "</span>"
  );
}

export function step(n: number, title: string, body: string): string {
  return (
    '<div style="margin:0 0 4px">' +
    '<span style="display:inline-block;width:28px;height:28px;line-height:28px;text-align:center;' +
    'background:#c8102e;color:#fff;border-radius:50%;font-weight:bold;margin-right:8px">' +
    String(n) +
    "</span>" +
    '<span style="font-size:17px;font-weight:bold">' +
    escapeHtml(title) +
    "</span>" +
    "</div>" +
    '<div style="margin:0 0 6px 36px;font-size:15px;line-height:1.6">' +
    body +
    "</div>"
  );
}

export function bigButton(label: string, url: string): string {
  return (
    '<a href="' +
    url +
    '" style="display:inline-block;background:#111;color:#fff;text-decoration:none;' +
    'border:2px solid #111;border-radius:8px;padding:12px 18px;font-weight:bold;font-size:15px">' +
    escapeHtml(label) +
    "</a>"
  );
}

export function instructionShell(kicker: string, title: string, bodyHtml: string): string {
  return (
    '<div style="font-family:Arial,Helvetica,sans-serif;color:#111;max-width:600px">' +
    '<div style="background:#c8102e;color:#fff;padding:16px 18px;border-radius:12px 12px 0 0">' +
    '<div style="font-size:13px;letter-spacing:3px">' +
    escapeHtml(kicker) +
    "</div>" +
    '<div style="font-size:22px;font-weight:bold;margin-top:4px">' +
    escapeHtml(title) +
    "</div></div>" +
    '<div style="border:2px solid #111;border-top:none;border-radius:0 0 12px 12px;padding:18px">' +
    bodyHtml +
    '<p style="margin:24px 0 0;font-size:12px;color:#888">Just Wheels Hessequa · automatic message</p>' +
    "</div></div>"
  );
}

export function detailRow(label: string, value: string): string {
  return (
    '<tr><td style="padding:4px 12px 4px 0;color:#666">' +
    escapeHtml(label) +
    '</td><td style="padding:4px 0;font-weight:bold">' +
    value +
    "</td></tr>"
  );
}
