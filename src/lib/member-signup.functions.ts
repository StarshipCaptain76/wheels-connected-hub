import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ADMIN_EMAIL, sendEmail } from "./email.server";
import { buildNewMemberAdminEmail } from "./member-signup-email.server";

const schema = z.object({
  email: z.string().trim().email().max(200),
  displayName: z.string().trim().max(120).optional().nullable(),
});

const FROM = "Just Wheels <members@notify.justwheels.co.za>";

/**
 * Public: notify the club admin that a new member signed up and needs approval.
 * Recipient is fixed to the club admin address; only the applicant details vary.
 */
export const notifyAdminNewMember = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const name = (data.displayName ?? "").trim() || data.email.split("@")[0];

    // In-app notification first: an email failure must never cancel it.
    try {
      const { fanOut } = await import("./notify.server");
      const res = await fanOut({
        type: "admin_new_member",
        title_en: "New member awaiting approval",
        title_af: "Nuwe lid wag vir goedkeuring",
        body_en: name + " (" + data.email + ")",
        body_af: name + " (" + data.email + ")",
        link: "/admin/members",
      });
      console.log("[members] in-app notification", res);
    } catch (e) {
      console.error("[members] in-app notification failed", e);
    }

    const html = buildNewMemberAdminEmail({ name, email: data.email });
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

