import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { useAuth } from "@/lib/auth";
import {
  CompactSeriesCard,
  ChapterCard,
  GridSeriesCard,
  HorizontalRow,
} from "@/components/SeriesCard";
import { useUserBookmarks } from "@/lib/use-bookmarks";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RAWL — Read any manga. In any language. Instantly." },
      { name: "description", content: "Discover, read, and translate manga, manhwa, and manhua. Join a community of readers and translators." },
      { property: "og:title", content: "RAWL — AI manga translation platform" },
      { property: "og:description", content: "Discover, read, and translate manga, manhwa, and manhua." },
    ],
  }),
  component: HomePage,
});

function SectionHeader({ title, href, dot }: { title: string; href?: string; dot?: boolean }) {
  return (
    <div className="flex items-center justify-between mb-3 px-1">
      <div className="flex items-center gap-2">
        {dot && <span className="h-2 w-2 rounded-full bg-success pulse-dot" />}
        <h2 className="text-base md:text-lg font-bold">{title}</h2>
      </div>
      {href && (
        <Link to={href as any} className="text-xs text-primary hover:underline flex items-center gap-1">
          See all <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="shrink-0 w-[125px]">
          <Skeleton className="aspect-[3/4] w-full rounded-lg" />
          <Skeleton className="h-3 w-3/4 mt-2" />
          <Skeleton className="h-2 w-1/2 mt-1" />
        </div>
      ))}
    </div>
  );
}

function HomePage() {
  const { user } = useAuth();
  const { data: bookmarkMap = {} } = useUserBookmarks();

  const { data: popular, isLoading: popLoading } = useQuery({
    queryKey: ["home-popular-series"],
    queryFn: async () => {
      const { data } = await supabase
        .from("series")
        .select("id, slug, title, cover_url, type, follow_count, rating")
        .order("follow_count", { ascending: false })
        .limit(15);
      return data ?? [];
    },
  });

  const { data: latest, isLoading: latestLoading } = useQuery({
    queryKey: ["home-latest-chapters"],
    queryFn: async () => {
      const { data } = await supabase
        .from("chapters")
        .select("id, chapter_number, release_date, series:series(id, slug, title, cover_url, type), translations(target_language, published)")
        .order("release_date", { ascending: false })
        .limit(15);
      return (data ?? []).filter((c: any) => c.series);
    },
  });

  const { data: ongoing, isLoading: ongoingLoading } = useQuery({
    queryKey: ["home-most-popular-ongoing"],
    queryFn: async () => {
      const { data } = await supabase
        .from("series")
        .select("id, slug, title, cover_url, type, follow_count, rating, genres")
        .eq("status", "ongoing")
        .order("follow_count", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  const { data: continueReading } = useQuery({
    queryKey: ["home-continue-reading", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("reading_history")
        .select("series_id, chapter_number, read_at, series:series(id, slug, title, cover_url, type)")
        .eq("user_id", user!.id)
        .order("read_at", { ascending: false })
        .limit(30);
      // Dedupe by series, keep latest entry per series
      const seen = new Set<string>();
      const out: any[] = [];
      for (const r of data ?? []) {
        if (!r.series || seen.has((r as any).series_id)) continue;
        seen.add((r as any).series_id);
        out.push(r);
        if (out.length >= 12) break;
      }
      return out;
    },
  });

  const { data: topTranslators } = useQuery({
    queryKey: ["home-top-translators"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("id, username, avatar_url, chapters_translated_total")
        .order("chapters_translated_total", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-6 space-y-10 pb-20">
        {/* Popular Right Now */}
        <section>
          <SectionHeader title="Popular Right Now" href="/catalogue" />
          {popLoading ? <RowSkeleton /> : (
            <HorizontalRow>
              {popular?.map((s: any) => (
                <CompactSeriesCard key={s.id} series={s} bookmarkStatus={bookmarkMap[s.id]} />
              ))}
            </HorizontalRow>
          )}
        </section>

        {/* New Releases */}
        <section>
          <SectionHeader title="New Releases" href="/billboard" dot />
          {latestLoading ? <RowSkeleton /> : (
            <HorizontalRow>
              {latest?.map((c: any) => (
                <ChapterCard
                  key={c.id}
                  series={c.series}
                  chapter_number={c.chapter_number}
                  release_date={c.release_date}
                  hasPublishedTranslation={c.translations?.some((t: any) => t.published)}
                  bookmarkStatus={bookmarkMap[c.series?.id]}
                />
              ))}
            </HorizontalRow>
          )}
        </section>

        {/* Continue Reading (logged in only) */}
        {user && continueReading && continueReading.length > 0 && (
          <section>
            <SectionHeader title="Continue Reading" href="/history" />
            <HorizontalRow>
              {continueReading.map((r: any) => (
                <CompactSeriesCard
                  key={r.series_id}
                  series={r.series}
                  subtitle={r.chapter_number ? `Ch. ${r.chapter_number}` : undefined}
                  bookmarkStatus={bookmarkMap[r.series_id]}
                />
              ))}
            </HorizontalRow>
          </section>
        )}

        {/* Most Popular Ongoing — grid */}
        <section>
          <SectionHeader title="Most Popular Ongoing" href="/catalogue" />
          {ongoingLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i}>
                  <Skeleton className="aspect-[3/4] w-full rounded-lg" />
                  <Skeleton className="h-3 w-3/4 mt-2" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {ongoing?.map((s: any) => (
                <GridSeriesCard
                  key={s.id}
                  series={s}
                  genre={s.genres?.[0] ?? null}
                  bookmarkStatus={bookmarkMap[s.id]}
                />
              ))}
            </div>
          )}
        </section>

        {/* Top Translators teaser */}
        <section>
          <SectionHeader title="Top Translators This Week" href="/leaderboard" />
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {topTranslators?.map((u: any, i: number) => (
              <Link
                key={u.id}
                to="/profile/$username"
                params={{ username: u.username ?? "" }}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/50 transition-colors"
              >
                <span className={`text-sm font-bold w-6 text-center ${i === 0 ? "text-warning" : i === 1 ? "text-muted-foreground" : i === 2 ? "text-purple-accent" : "text-muted-foreground"}`}>
                  #{i + 1}
                </span>
                <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold overflow-hidden">
                  {u.avatar_url ? <img src={u.avatar_url} alt="" className="h-full w-full object-cover" /> : (u.username ?? "?").slice(0, 2).toUpperCase()}
                </div>
                <span className="text-sm font-medium flex-1 truncate">@{u.username}</span>
                <span className="text-xs text-muted-foreground">{u.chapters_translated_total} translations</span>
              </Link>
            ))}
            {(!topTranslators || topTranslators.length === 0) && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">No translators yet — be the first!</div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
