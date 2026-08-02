/** Admin notification email for a new sponsor application — plain-language, illustrated. */
import { escapeHtml, SITE_ORIGIN } from "./email.server";
import {
  bigButton,
  detailRow,
  fakeButton,
  instructionShell,
  step,
  stepImage,
} from "./email-steps.server";

export function buildSponsorApplicationAdminEmail(input: {
  business: string;
  contact: string;
  email: string;
  phone?: string;
  website?: string;
  message?: string;
  stored: boolean;
}): string {
  const sponsorsUrl = SITE_ORIGIN + "/admin/sponsors";

  const rows =
    detailRow("Business", escapeHtml(input.business)) +
    detailRow("Contact person", escapeHtml(input.contact)) +
    detailRow(
      "Email",
      '<a href="mailto:' + escapeHtml(input.email) + '">' + escapeHtml(input.email) + "</a>",
    ) +
    (input.phone ? detailRow("Phone", escapeHtml(input.phone)) : "") +
    (input.website ? detailRow("Website", escapeHtml(input.website)) : "") +
    (input.message ? detailRow("Message", escapeHtml(input.message)) : "");

  const body =
    '<p style="font-size:16px;line-height:1.6;margin:0 0 14px">' +
    "A business has asked to sponsor the club. Nothing happens until you approve it." +
    "</p>" +
    '<table style="border-collapse:collapse;margin:0 0 20px;font-size:15px">' +
    rows +
    "</table>" +
    (input.stored
      ? ""
      : '<p style="font-size:15px;line-height:1.6;margin:0 0 16px;background:#fee2e2;border:2px solid #111;' +
        'border-radius:8px;padding:12px"><b>Please note:</b> this application could not be saved in the app. ' +
        "Simply reply to this email to answer the business.</p>") +
    '<h3 style="font-size:18px;margin:0 0 14px;border-top:2px solid #111;padding-top:14px">' +
    "How to approve this sponsor (about 2 minutes)</h3>" +
    step(
      1,
      "Open the sponsors page",
      "Tap this big button:<br><br>" +
        bigButton("OPEN SPONSOR APPLICATIONS", sponsorsUrl) +
        "<br><br>If the button does not work, type this address into your browser:<br>" +
        '<span style="color:#c8102e">' +
        escapeHtml(sponsorsUrl) +
        "</span>",
    ) +
    stepImage("The button looks like this in the email", fakeButton("OPEN SPONSOR APPLICATIONS", "#111")) +
    step(
      2,
      "Sign in if it asks",
      "If the app asks for your email and password, sign in with your admin account. " +
        "If you are already signed in, you go straight to the page.",
    ) +
    step(
      3,
      "Find the application",
      "Scroll to the block called <b>Applications</b>. New ones sit at the top with an orange " +
        '<b style="color:#b45309">PENDING</b> label. Look for <b>' +
        escapeHtml(input.business) +
        "</b>.",
    ) +
    stepImage(
      "An application looks like this on the page",
      '<div style="border:2px solid #111;border-radius:8px;background:#fff;padding:10px 12px">' +
        '<div style="font-weight:bold;font-size:15px">' +
        escapeHtml(input.business) +
        "</div>" +
        '<div style="font-size:13px;color:#666">' +
        escapeHtml(input.contact) +
        " · " +
        escapeHtml(input.email) +
        "</div>" +
        '<div style="margin-top:8px">' +
        '<span style="display:inline-block;background:#fde68a;border:2px solid #111;border-radius:999px;' +
        'padding:3px 10px;font-size:11px;font-weight:bold">PENDING</span>' +
        '<span style="display:inline-block;width:10px"></span>' +
        fakeButton("APPROVE", "#15803d") +
        '<span style="display:inline-block;width:10px"></span>' +
        fakeButton("DECLINE", "#b91c1c") +
        "</div></div>",
    ) +
    step(
      4,
      "Press the green APPROVE button",
      "A small window opens. You must fill in three things there — see the next step.",
    ) +
    step(
      5,
      "Choose the member and the dates",
      "<b>Member:</b> type a name, email or member number and pick the club member who will look after " +
        "this sponsor card.<br>" +
        "<b>Start date:</b> the day the sponsorship begins (usually today).<br>" +
        "<b>End date:</b> the day it runs out (usually one year later).<br>" +
        "Then press <b>Approve &amp; notify</b>.",
    ) +
    stepImage(
      "The approve window looks like this",
      '<div style="border:2px solid #111;border-radius:8px;background:#fff;padding:12px">' +
        '<div style="font-weight:bold;font-size:15px;margin-bottom:8px">Approve ' +
        escapeHtml(input.business) +
        "</div>" +
        '<div style="border:1px solid #999;border-radius:6px;padding:7px 9px;font-size:13px;color:#666;margin-bottom:8px">' +
        "Search by name, email or member number</div>" +
        '<div style="border:1px solid #999;border-radius:6px;padding:7px 9px;font-size:13px;color:#666;margin-bottom:4px">' +
        "Start date</div>" +
        '<div style="border:1px solid #999;border-radius:6px;padding:7px 9px;font-size:13px;color:#666;margin-bottom:10px">' +
        "End date</div>" +
        fakeButton("APPROVE & NOTIFY", "#15803d") +
        "</div>",
    ) +
    '<p style="font-size:15px;line-height:1.6;margin:18px 0 0;background:#f4f1ea;border:2px solid #111;' +
    'border-radius:8px;padding:12px">' +
    "<b>What happens next:</b> the business gets an email telling them they are approved, and the member you " +
    "chose can fill in the sponsor logo and details on the app." +
    "</p>" +
    '<p style="font-size:14px;line-height:1.6;margin:18px 0 0;color:#555">' +
    "Not interested in this sponsor? Press <b>DECLINE</b>, or simply do nothing." +
    "</p>";

  return instructionShell("JUST WHEELS HESSEQUA", "A new sponsor is waiting for you", body);
}
