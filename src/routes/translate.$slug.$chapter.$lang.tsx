import { createFileRoute, redirect } from "@tanstack/react-router";

// Alt-URL pattern → 301 to canonical chapter route
// /translate/solo-leveling/266/en → /series/solo-leveling/chapter/266
export const Route = createFileRoute("/translate/$slug/$chapter/$lang")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        // Strip "chapter-" prefix if present
        const ch = params.chapter.replace(/^chapter-?/i, "");
        const url = `/series/${params.slug}/chapter/${ch}`;
        return new Response(null, { status: 301, headers: { Location: url } });
      },
    },
  },
  beforeLoad: ({ params }) => {
    const ch = params.chapter.replace(/^chapter-?/i, "");
    throw redirect({
      to: "/series/$slug/chapter/$chapter",
      params: { slug: params.slug, chapter: ch },
      replace: true,
    });
  },
});
