import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import {
  CompactSeriesCard,
  GridSeriesCard,
  HorizontalRow,
} from "@/components/SeriesCard";
import { useUserBookmarks } from "@/lib/use-bookmarks";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/novels")({
  head: () => ({
    meta: [
      { title: "Novels — Read translated web novels | RAWL" },
      { name: "description", content: "Browse and read translated web novels and light novels. Discover trending titles and the latest chapters." },
      { property: "og:title", content: "Novels — RAWL" },
      { property: "og:description", content: "Translated web novels and light novels in your language." },
    ],
  }),
  component: NovelsPage,
});

function SectionHeader({ title, href }: { title: string; href?: string }) {
  return (
    <div className="flex items-center justify-between mb-3 px-1">
      <h2 className="text-base md:text-lg font-bold">{title}</h2>
      {href && (
        <Link to={href as any} className="text-xs text-primary hover:underline flex items-center gap-1">
          See all <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

function NovelsPage() {
  const { data: bookmarkMap = {} } = useUserBookmarks();

  const { data: popular, isLoading: popLoading } = useQuery({
    queryKey: ["novels-popular"],
    queryFn: async () => {
      const { data } = await supabase
        .from("series")
        .select("id, slug, title, cover_url, type, follow_count, rating")
        .eq("type", "novel")
        .order("follow_count", { ascending: false })
        .limit(15);
      return data ?? [];
    },
  });

  const { data: ongoing, isLoading: ongoingLoading } = useQuery({
    queryKey: ["novels-ongoing"],
    queryFn: async () => {
      const { data } = await supabase
        .from("series")
        .select("id, slug, title, cover_url, type, follow_count, rating, genres")
        .eq("type", "novel")
        .eq("status", "ongoing")
        .order("follow_count", { ascending: false })
        .limit(12);
      return data ?? [];
    },
  });

  const isEmpty =
    !popLoading && !ongoingLoading &&
    (popular?.length ?? 0) === 0 &&
    (ongoing?.length ?? 0) === 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-6 space-y-10 pb-20">
        <div className="flex items-center gap-3">
          <BookOpen className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Novels</h1>
            <p className="text-sm text-muted-foreground">Translated web novels & light novels.</p>
          </div>
        </div>

        {isEmpty ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 font-semibold">No novels yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Check back soon — translators are working on it.</p>
          </div>
        ) : (
          <>
            <section>
              <SectionHeader title="Popular Novels" href="/catalogue" />
              {popLoading ? (
                <div className="flex gap-3 overflow-hidden">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="shrink-0 w-[125px]">
                      <Skeleton className="aspect-[3/4] w-full rounded-lg" />
                    </div>
                  ))}
                </div>
              ) : (
                <HorizontalRow>
                  {popular?.map((s: any) => (
                    <CompactSeriesCard key={s.id} series={s} bookmarkStatus={bookmarkMap[s.id]} />
                  ))}
                </HorizontalRow>
              )}
            </section>

            <section>
              <SectionHeader title="Ongoing Novels" />
              {ongoingLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="aspect-[3/4] w-full rounded-lg" />
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
          </>
        )}
      </main>
    </div>
  );
}
