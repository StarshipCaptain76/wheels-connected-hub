import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/SiteLayout";
import { HomePolls } from "@/components/HomePolls";
import { LOGO_URL } from "@/lib/brand";

const SITE_ORIGIN = "https://www.justwheels.co.za";
const OG_LOGO = `${SITE_ORIGIN}${LOGO_URL}`;

export const Route = createFileRoute("/polls")({
  head: () => ({
    meta: [
      { title: "Club polls | Just Wheels Hessequa" },
      {
        name: "description",
        content: "Vote on Just Wheels Hessequa club polls — next outing, driving distance, and more.",
      },
      { property: "og:title", content: "Club polls | Just Wheels Hessequa" },
      { property: "og:description", content: "Vote on the latest Just Wheels club polls." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_ORIGIN}/polls` },
      { property: "og:image", content: OG_LOGO },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_ORIGIN}/polls` }],
  }),
  component: PollsPage,
});

function PollsPage() {
  return (
    <SiteLayout>
      <HomePolls asPage />
    </SiteLayout>
  );
}
