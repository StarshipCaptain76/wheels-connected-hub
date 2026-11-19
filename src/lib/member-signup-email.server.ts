/** Informational admin notice; new members no longer need approval. */
import { escapeHtml, SITE_ORIGIN } from "./email.server";
import { bigButton, detailBox, linkFallback, shotShell } from "./email-shot.server";

export function buildNewMemberAdminEmail(input: { name: string; email: string }): string {
  const url = SITE_ORIGIN + "/admin/members";

  const body =
    '<p style="font-size:16px;line-height:1.5;margin:0 0 16px">' +
    "A new member signed up and their club membership is automatically active. No admin approval is needed. Email verification still applies." +
    "</p>" +
    detailBox([
      ["Name", escapeHtml(input.name)],
      ["Email", escapeHtml(input.email)],
    ]) +
    '<p style="margin:0 0 6px">' +
    bigButton("VIEW MEMBERS", url) +
    "</p>" +
    linkFallback(url);

  return shotShell("JUST WHEELS HESSEQUA", "Welcome to our new member", body);
}
