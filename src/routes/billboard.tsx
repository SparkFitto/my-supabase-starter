import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Flame, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { typeLabel, timeAgo } from "@/lib/constants";

export const Route = createFileRoute("/billboard")({
  head: () => ({
    meta: [
      { title: "Billboard — Trending manga, manhwa, manhua | RAWL" },
      { name: "description", content: "What everyone is translating right now. The top trending manga, manhwa, and manhua chapters across every language." },
      { property: "og:title", content: "RAWL Billboard — Trending translations" },
      { property: "og:description", content: "See the most-read translated chapters of the week." },
    ],
  }),
  component: BillboardPage,
});

function BillboardPage() {
  const { data: trending } = useQuery({
    queryKey: ["billboard-trending"],
    queryFn: async () => {
      const { data } = await supabase
        .from("series")
        .select("id, slug, title, cover_url, type, follow_count, rating, genres")
        .order("follow_count", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const { data: latest } = useQuery({
    queryKey: ["billboard-latest"],
    queryFn: async () => {
      const { data } = await supabase
        .from("translations")
        .select("id, target_language, created_at, chapter:chapters(chapter_number, series:series(slug, title, cover_url, type))")
        .eq("published", true)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-10">
          <h1 className="text-4xl font-bold tracking-tight">Billboard</h1>
          <p className="mt-2 text-muted-foreground">What the world is reading and translating right now.</p>
        </div>

        <section className="mb-12">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
            <Flame className="h-5 w-5 text-warning" /> Trending series
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {trending?.map((s, i) => (
              <Link key={s.id} to="/series/$slug" params={{ slug: s.slug }} className="group relative">
                <div className="relative overflow-hidden rounded-lg bg-muted aspect-[2/3]">
                  {s.cover_url ? (
                    <img src={s.cover_url} alt={s.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
                  ) : <div className="h-full w-full bg-secondary" />}
                  <div className="absolute left-2 top-2 rounded bg-background/80 px-2 py-0.5 font-mono text-xs backdrop-blur">#{i + 1}</div>
                </div>
                <p className="mt-2 line-clamp-2 text-sm font-medium">{s.title}</p>
                <p className="font-mono text-xs text-muted-foreground">{typeLabel(s.type)} · {s.follow_count.toLocaleString()} ★</p>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
            <Clock className="h-5 w-5 text-primary" /> Just translated
          </h2>
          <div className="space-y-2">
            {latest?.map((t) => {
              const ch = t.chapter as { chapter_number: string; series: { slug: string; title: string; cover_url: string; type: string } } | null;
              if (!ch?.series) return null;
              return (
                <Link key={t.id} to="/read/$translationId" params={{ translationId: t.id }} className="flex items-center gap-3 rounded-md border border-border bg-card p-3 hover:border-primary transition-colors">
                  <img src={ch.series.cover_url ?? ""} alt="" className="h-12 w-9 rounded object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{ch.series.title}</p>
                    <p className="font-mono text-xs text-muted-foreground">Ch. {ch.chapter_number} · {t.target_language.toUpperCase()}</p>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">{timeAgo(t.created_at)}</span>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
