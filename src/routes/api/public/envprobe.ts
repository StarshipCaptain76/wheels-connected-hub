import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/envprobe")({
  server: {
    handlers: {
      GET: async () =>
        new Response(
          JSON.stringify({
            hasKey: Boolean(process.env["LOVABLE_API_KEY"]),
            keys: Object.keys(process.env).filter((k) => k.includes("LOVABLE")),
          }),
          { headers: { "content-type": "application/json" } },
        ),
    },
  },
});
