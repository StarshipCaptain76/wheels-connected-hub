import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SiteLayout } from "../components/SiteLayout";

function NotFoundComponent() {
  return (
    <SiteLayout>
      <section className="mx-auto max-w-xl px-4 py-24 text-center">
        <p className="font-display text-xs tracking-[0.3em] text-primary">404</p>
        <h1 className="mt-2 font-display text-5xl tracking-wide text-ink sm:text-6xl">
          Off the map
        </h1>
        <p className="mt-3 text-ink/70">
          That page took a wrong turn. Get back on the road below.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/"
            className="rounded-md border-2 border-ink bg-primary px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-paper shadow-[3px_3px_0_0_var(--color-ink)] transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"
          >
            Home
          </Link>
          <Link
            to="/events"
            className="rounded-md border-2 border-ink bg-paper px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-ink hover:bg-ink/5"
          >
            Events
          </Link>
          <Link
            to="/classifieds"
            className="rounded-md border-2 border-ink bg-paper px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-ink hover:bg-ink/5"
          >
            Classifieds
          </Link>
        </div>
      </section>
    </SiteLayout>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <SiteLayout>
      <section className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="font-display text-3xl tracking-wide text-ink">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-ink/70">
          Something went wrong on our end. You can try again or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-md border-2 border-ink bg-primary px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-paper shadow-[3px_3px_0_0_var(--color-ink)] transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"
          >
            Try again
          </button>
          <Link
            to="/"
            className="rounded-md border-2 border-ink bg-paper px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-ink hover:bg-ink/5"
          >
            Go home
          </Link>
        </div>
      </section>
    </SiteLayout>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#c22" },
      { name: "author", content: "Just Wheels Hessequa" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Just Wheels Hessequa" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32x32.png" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16x16.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@400;500;600;700;800&display=swap",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Just Wheels Hessequa",
          url: "https://justwheels.co.za",
          logo: "https://justwheels.co.za/icon-512.png",
          description:
            "Community car club in the Southern Cape — Riversdale, Stilbaai, Heidelberg, Albertinia.",
          areaServed: "Hessequa, Southern Cape, South Africa",
          sameAs: [],
        }),
      },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

import { I18nProvider } from "../i18n/I18nProvider";
import { supabase } from "@/integrations/supabase/client";
import { registerPwa } from "../lib/pwa-register";
import { InstallPrompt } from "../components/InstallPrompt";
import { OfflineBanner } from "../components/OfflineBanner";

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    registerPwa();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <OfflineBanner />
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
        <InstallPrompt />
      </I18nProvider>
    </QueryClientProvider>
  );
}

