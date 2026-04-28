import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

const SITE = "https://rawl.app";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { data: series } = await supabase.from("series").select("slug, created_at").limit(5000);
        const { data: chapters } = await supabase
          .from("chapters")
          .select("chapter_number, release_date, series:series(slug)")
          .limit(10000);

        const staticUrls = ["", "/billboard", "/catalogue", "/leaderboard", "/updates"].map(
          (p) => `<url><loc>${SITE}${p}</loc><changefreq>daily</changefreq></url>`,
        );
        const seriesUrls = (series ?? []).map(
          (s) => `<url><loc>${SITE}/series/${s.slug}</loc><lastmod>${s.created_at}</lastmod><changefreq>daily</changefreq></url>`,
        );
        const chapterUrls = (chapters ?? []).map((c) => {
          const sl = (c.series as { slug?: string } | null)?.slug;
          if (!sl) return "";
          return `<url><loc>${SITE}/series/${sl}/chapter/${c.chapter_number}</loc>${c.release_date ? `<lastmod>${c.release_date}</lastmod>` : ""}</url>`;
        });

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticUrls, ...seriesUrls, ...chapterUrls].join("\n")}
</urlset>`;
        return new Response(xml, { headers: { "Content-Type": "application/xml" } });
      },
    },
  },
});
