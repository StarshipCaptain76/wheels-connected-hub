/** Invite email sent on behalf of a member who tagged someone not yet in the club. */
import { escapeHtml, SITE_ORIGIN } from "./email.server";
import { bigButton, linkFallback } from "./email-shot.server";

export function buildTagInviteEmail(input: {
  taggerName: string;
  photoUrl: string;
  photoTitle?: string | null;
  note?: string | null;
}): { subject: string; html: string } {
  const joinUrl = SITE_ORIGIN + "/join";
  const name = escapeHtml(input.taggerName);

  const html =
    '<div style="font-family:Arial,Helvetica,sans-serif;color:#140e0c;max-width:460px;margin:0 auto">' +
    '<div style="background:#140e0c;color:#f5f0e8;padding:18px 20px;border-radius:14px 14px 0 0">' +
    '<div style="font-size:11px;letter-spacing:4px;color:#cc2222">JUST WHEELS · HESSEQUA</div>' +
    '<div style="font-size:22px;font-weight:bold;margin-top:6px;line-height:1.3">' +
    name +
    " tagged you in a photo</div></div>" +
    '<div style="border:2px solid #140e0c;border-top:none;border-radius:0 0 14px 14px;padding:0 0 20px;background:#f5f0e8">' +
    '<img src="' +
    escapeHtml(input.photoUrl) +
    '" alt="" width="456" style="display:block;width:100%;border-bottom:2px solid #140e0c">' +
    '<div style="padding:18px 20px 0">' +
    (input.photoTitle
      ? '<p style="margin:0 0 12px;font-size:13px;color:#140e0c;opacity:.7">' +
        escapeHtml(input.photoTitle) +
        "</p>"
      : "") +
    '<p style="font-size:16px;line-height:1.6;margin:0 0 14px">' +
    "You have been tagged in a Just Wheels Hessequa club photo by <b>" +
    name +
    "</b>." +
    "</p>" +
    (input.note
      ? '<p style="font-size:15px;line-height:1.6;margin:0 0 14px;border-left:4px solid #cc2222;' +
        'padding:8px 12px;background:#fff">' +
        escapeHtml(input.note) +
        "</p>"
      : "") +
    '<p style="font-size:15px;line-height:1.6;margin:0 0 18px">' +
    "Join the club and the photos you appear in become part of your own member profile." +
    "</p>" +
    '<p style="margin:0 0 6px">' +
    bigButton("JOIN JUST WHEELS", joinUrl) +
    "</p>" +
    linkFallback(joinUrl) +
    '<p style="margin:20px 0 0;font-size:12px;color:#8a7f78">' +
    "Sent on behalf of " +
    name +
    " · just reply to this email to reach them." +
    "</p>" +
    "</div></div></div>";

  return { subject: input.taggerName + " tagged you in a Just Wheels photo", html };
}
