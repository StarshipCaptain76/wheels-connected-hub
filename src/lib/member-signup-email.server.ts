/** Admin notification for a new member sign-up — short steps with real screenshots. */
import { escapeHtml, SITE_ORIGIN } from "./email.server";
import { bigButton, detailBox, linkFallback, shot, shotShell, textStep } from "./email-shot.server";

export function buildNewMemberAdminEmail(input: { name: string; email: string }): string {
  const url = SITE_ORIGIN + "/admin/members";

  const body =
    '<p style="font-size:16px;line-height:1.5;margin:0 0 16px">' +
    "A new person signed up. They cannot use the members area until you approve them." +
    "</p>" +
    detailBox([
      ["Name", escapeHtml(input.name)],
      ["Email", escapeHtml(input.email)],
    ]) +
    '<p style="margin:0 0 6px">' +
    bigButton("OPEN MEMBER APPROVALS", url) +
    "</p>" +
    linkFallback(url) +
    '<hr style="border:none;border-top:2px solid #111;margin:22px 0" />' +
    '<p style="font-size:15px;margin:0 0 18px;color:#555">Three taps. Each picture below is what you will see.</p>' +
    shot(1, "Tap the red button at the top of the page.", "members-1.png", url) +
    shot(2, 'Look under "Pending approval" for the name above.', "members-2.png", url) +
    shot(
      3,
      'Slide the list sideways and change "pending" to "approved".',
      "members-3.png",
      url,
    ) +
    textStep(4, "Done — the member can now use the app.") +
    '<p style="font-size:15px;line-height:1.5;margin:0;background:#f4f1ea;border:2px solid #111;' +
    'border-radius:8px;padding:12px">' +
    "<b>Quicker:</b> if several people are waiting, tap <b>APPROVE ALL PENDING</b> (picture 1) once." +
    "</p>" +
    '<p style="font-size:14px;line-height:1.5;margin:16px 0 0;color:#555">' +
    "Do not know this person? Do nothing, or set them to <b>declined</b>." +
    "</p>";

  return shotShell("JUST WHEELS HESSEQUA", "New member waiting for approval", body);
}
