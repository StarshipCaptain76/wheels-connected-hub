/** Admin notification for a new sponsor application — short steps with real screenshots. */
import { escapeHtml, SITE_ORIGIN } from "./email.server";
import { bigButton, detailBox, linkFallback, shot, shotShell, textStep } from "./email-shot.server";

export function buildSponsorApplicationAdminEmail(input: {
  business: string;
  contact: string;
  email: string;
  phone?: string;
  website?: string;
  message?: string;
  stored: boolean;
}): string {
  const url = SITE_ORIGIN + "/admin/sponsors";

  const rows: Array<[string, string]> = [
    ["Business", escapeHtml(input.business)],
    ["Contact", escapeHtml(input.contact)],
    [
      "Email",
      '<a href="mailto:' + escapeHtml(input.email) + '" style="color:#c8102e">' + escapeHtml(input.email) + "</a>",
    ],
  ];
  if (input.phone) rows.push(["Phone", escapeHtml(input.phone)]);
  if (input.website) rows.push(["Website", escapeHtml(input.website)]);
  if (input.message) rows.push(["Message", escapeHtml(input.message)]);

  const body =
    '<p style="font-size:16px;line-height:1.5;margin:0 0 16px">' +
    "A business wants to sponsor the club. Nothing happens until you approve it." +
    "</p>" +
    detailBox(rows) +
    (input.stored
      ? ""
      : '<p style="font-size:15px;line-height:1.5;margin:0 0 16px;background:#fee2e2;border:2px solid #111;' +
        'border-radius:8px;padding:12px"><b>Note:</b> this application was not saved in the app. ' +
        "Just reply to this email to answer the business.</p>") +
    '<p style="margin:0 0 6px">' +
    bigButton("OPEN SPONSOR APPLICATIONS", url) +
    "</p>" +
    linkFallback(url) +
    '<hr style="border:none;border-top:2px solid #111;margin:22px 0" />' +
    '<p style="font-size:15px;margin:0 0 18px;color:#555">Three taps. Each picture below is what you will see.</p>' +
    shot(1, "Tap the red button above to open the page.", "sponsors-1.png", url) +
    shot(2, "Find the business under PENDING and tap the green APPROVE.", "sponsors-2.png", url) +
    textStep(
      3,
      "In the small window: pick the club member who looks after this sponsor, choose a start date " +
        "and an end date, then tap <b>Approve &amp; notify</b>.",
    ) +
    '<p style="font-size:15px;line-height:1.5;margin:0;background:#f4f1ea;border:2px solid #111;' +
    'border-radius:8px;padding:12px">' +
    "The business gets an email saying they are approved, and the member you picked can fill in the sponsor logo." +
    "</p>" +
    '<p style="font-size:14px;line-height:1.5;margin:16px 0 0;color:#555">' +
    "Not interested? Tap <b>DECLINE</b>, or do nothing." +
    "</p>";

  return shotShell("JUST WHEELS HESSEQUA", "New sponsor waiting for approval", body);
}
