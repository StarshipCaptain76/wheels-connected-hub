import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ADMIN_EMAIL, SITE_ORIGIN, escapeHtml, sendEmail } from "./email.server";

const schema = z.object({
  email: z.string().trim().email().max(200),
  displayName: z.string().trim().max(120).optional().nullable(),
});

const FROM = "Just Wheels <members@notify.justwheels.co.za>";

function stepImage(caption: string, inner: string): string {
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

function fakeButton(label: string, bg: string): string {
  return (
    '<span style="display:inline-block;background:' +
    bg +
    ';color:#fff;border:2px solid #111;border-radius:8px;padding:8px 14px;' +
    'font-weight:bold;font-size:13px;letter-spacing:1px">' +
    escapeHtml(label) +
    "</span>"
  );
}

function step(n: number, title: string, body: string): string {
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

/**
 * Public: notify the club admin that a new member signed up and needs approval.
 * Recipient is fixed to the club admin address; only the applicant details vary.
 */
export const notifyAdminNewMember = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const name = (data.displayName ?? "").trim() || data.email.split("@")[0];
    const membersUrl = SITE_ORIGIN + "/admin/members";

    const html =
      '<div style="font-family:Arial,Helvetica,sans-serif;color:#111;max-width:600px">' +
      '<div style="background:#c8102e;color:#fff;padding:16px 18px;border-radius:12px 12px 0 0">' +
      '<div style="font-size:13px;letter-spacing:3px">JUST WHEELS HESSEQUA</div>' +
      '<div style="font-size:22px;font-weight:bold;margin-top:4px">A new member is waiting for you</div>' +
      "</div>" +
      '<div style="border:2px solid #111;border-top:none;border-radius:0 0 12px 12px;padding:18px">' +
      '<p style="font-size:16px;line-height:1.6;margin:0 0 14px">' +
      "Someone has just signed up on the Just Wheels app. They cannot use the members area until you approve them." +
      "</p>" +
      '<table style="border-collapse:collapse;margin:0 0 20px;font-size:15px">' +
      '<tr><td style="padding:4px 12px 4px 0;color:#666">Name</td><td style="padding:4px 0;font-weight:bold">' +
      escapeHtml(name) +
      "</td></tr>" +
      '<tr><td style="padding:4px 12px 4px 0;color:#666">Email</td><td style="padding:4px 0;font-weight:bold">' +
      escapeHtml(data.email) +
      "</td></tr>" +
      "</table>" +

      '<h3 style="font-size:18px;margin:0 0 14px;border-top:2px solid #111;padding-top:14px">' +
      "How to approve this person (about 1 minute)</h3>" +

      step(
        1,
        "Open the members page",
        'Tap this big button:<br><br><a href="' +
          membersUrl +
          '" style="display:inline-block;background:#111;color:#fff;text-decoration:none;' +
          'border:2px solid #111;border-radius:8px;padding:12px 18px;font-weight:bold;font-size:15px">' +
          "OPEN MEMBER APPROVALS</a><br><br>" +
          'If the button does not work, type this address into your browser:<br><span style="color:#c8102e">' +
          escapeHtml(membersUrl) +
          "</span>",
      ) +
      stepImage(
        "The button looks like this in the email",
        fakeButton("OPEN MEMBER APPROVALS", "#111"),
      ) +

      step(
        2,
        "Sign in if it asks",
        "If the app asks for your email and password, sign in with your admin account (" +
          escapeHtml(ADMIN_EMAIL) +
          "). If you are already signed in, nothing will happen and you go straight to the list.",
      ) +

      step(
        3,
        "Find the person in the list",
        "New people sit at the top of the list with an orange label that says " +
          '<b style="color:#b45309">PENDING</b>. Look for the name and email shown above.',
      ) +
      stepImage(
        "A pending member looks like this in the list",
        '<div style="border:2px solid #111;border-radius:8px;background:#fff;padding:10px 12px">' +
          '<div style="font-weight:bold;font-size:15px">' +
          escapeHtml(name) +
          "</div>" +
          '<div style="font-size:13px;color:#666">' +
          escapeHtml(data.email) +
          "</div>" +
          '<div style="margin-top:8px">' +
          '<span style="display:inline-block;background:#fde68a;border:2px solid #111;border-radius:999px;' +
          'padding:3px 10px;font-size:11px;font-weight:bold">PENDING</span>' +
          '<span style="display:inline-block;width:10px"></span>' +
          fakeButton("APPROVE", "#15803d") +
          "</div></div>",
      ) +

      step(
        4,
        "Press the green APPROVE button",
        "Press <b>APPROVE</b> next to their name. The orange PENDING label changes to a green " +
          "<b>APPROVED</b> label. That is all — the member can now use the app.",
      ) +
      stepImage(
        "After approving, the label turns green",
        '<span style="display:inline-block;background:#bbf7d0;border:2px solid #111;border-radius:999px;' +
          'padding:3px 10px;font-size:11px;font-weight:bold">APPROVED</span>',
      ) +

      '<p style="font-size:15px;line-height:1.6;margin:18px 0 0;background:#f4f1ea;border:2px solid #111;' +
      'border-radius:8px;padding:12px">' +
      "<b>Tip:</b> If more than one person is waiting, there is a button at the top of the page that says " +
      "<b>APPROVE ALL PENDING</b>. Press it once and everyone waiting is approved together." +
      "</p>" +

      '<p style="font-size:14px;line-height:1.6;margin:18px 0 0;color:#555">' +
      "Do you not know this person? Then simply do nothing, or press <b>DECLINE</b>. They stay locked out of the members area." +
      "</p>" +

      '<p style="margin:24px 0 0;font-size:12px;color:#888">Just Wheels Hessequa · automatic message</p>' +
      "</div></div>";

    try {
      await sendEmail({
        to: [ADMIN_EMAIL],
        subject: "New member sign-up: " + name + " — approval needed",
        html,
        from: FROM,
        replyTo: data.email,
      });
    } catch (err) {
      console.error("Admin new-member notification failed", err);
      return { ok: false as const };
    }
    return { ok: true as const };
  });
