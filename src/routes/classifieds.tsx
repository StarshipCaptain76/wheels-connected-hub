import { createFileRoute, Outlet } from "@tanstack/react-router";

const SITE_ORIGIN = "https://www.justwheels.co.za";
const OG_LOGO = `${SITE_ORIGIN}/__l5e/assets-v1/1ea9f7fc-2fa5-428f-a1df-f1a298d9caaa/justwheels-logo.jpeg`;

export const Route = createFileRoute("/classifieds")({
  head: () => ({
    meta: [
      { title: "Classifieds | Just Wheels Hessequa" },
      {
        name: "description",
        content:
          "Cars, parts and motoring memorabilia for sale by Just Wheels Hessequa members. Contact the seller directly.",
      },
      { property: "og:title", content: "Classifieds | Just Wheels Hessequa" },
      {
        property: "og:description",
        content: "Cars, parts and memorabilia from club members.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_ORIGIN}/classifieds` },
      { property: "og:image", content: OG_LOGO },
      { name: "twitter:image", content: OG_LOGO },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_ORIGIN}/classifieds` }],
  }),
  component: () => <Outlet />,
});
