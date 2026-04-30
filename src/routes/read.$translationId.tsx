import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CardDropTrigger } from "@/components/cards/CardDropToast";
import { CardSubmitButton } from "@/components/cards/CardSubmitButton";
import { useAuth } from "@/lib/auth";
import { useInkRewards } from "@/hooks/useInkRewards";

export const Route = createFileRoute("/read/$translationId")({
  head: () => ({ meta: [{ title: "Read — RAWL" }] }),
  component: ReaderPage,
});

function ReaderPage() {
  const { translationId } = Route.useParams();
  const [mode, setMode] = useState<"long_strip" | "single">("long_strip");
  const [page, setPage] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["translation", translationId],
    queryFn: async () => {
      const { data } = await supabase
        .from("translations")
        .select("id, target_language, image_urls, page_count, chapter:chapters(id, chapter_number, content, series_id, series:series(id, slug, title, type))")
        .eq("id", translationId)
        .maybeSingle();
      return data;
    },
  });

  const images = data?.image_urls ?? [];
  const chapter = data?.chapter as { chapter_number?: string; content?: string | null; series_id?: string; series?: { id: string; slug: string; title: string; type: string } } | null;
  const series = chapter?.series;
  const chapterNum = chapter?.chapter_number;
  const isNovel = series?.type === "novel";
  const novelText = chapter?.content ?? "";
  const seriesId = series?.id ?? chapter?.series_id ?? null;

  // Reading history + Ink reward (once per chapter, after 5s of reading)
  const { user } = useAuth();
  const { award } = useInkRewards();
  const loggedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user || !seriesId || !translationId) return;
    if (loggedRef.current === translationId) return;
    const t = setTimeout(async () => {
      loggedRef.current = translationId;
      await supabase.from("reading_history").insert({
        user_id: user.id,
        series_id: seriesId,
        translation_id: translationId,
        chapter_number: chapterNum ?? null,
      });
      award("reading_chapter", { silent: true });
    }, 5000);
    return () => clearTimeout(t);
  }, [user, seriesId, translationId, chapterNum, award]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <CardDropTrigger seriesId={seriesId} translationId={translationId} />
      <div className="sticky top-16 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="min-w-0">
            {series ? (
              <Link to="/series/$slug" params={{ slug: series.slug }} className="block truncate text-sm font-semibold hover:text-primary">
                {series.title}
              </Link>
            ) : <div className="h-4 w-32 animate-pulse rounded bg-muted" />}
            <p className="font-mono text-xs text-muted-foreground">Chapter {chapterNum ?? "—"}</p>
          </div>
          <div className="flex items-center gap-2">
            {!isNovel && (
              <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
                <TabsList>
                  <TabsTrigger value="long_strip">Long strip</TabsTrigger>
                  <TabsTrigger value="single">Page</TabsTrigger>
                </TabsList>
              </Tabs>
            )}
            {seriesId && <CardSubmitButton seriesId={seriesId} seriesTitle={series?.title} />}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-2 py-6">
        {isLoading ? (
          <div className="flex h-96 items-center justify-center text-muted-foreground">Loading…</div>
        ) : isNovel ? (
          novelText ? (
            <article className="prose prose-invert mx-auto max-w-2xl px-4 font-serif text-[17px] leading-8 text-foreground/90">
              {novelText.split(/\n\s*\n/).map((para, i) => (
                <p key={i} className="mb-5 whitespace-pre-wrap">{para}</p>
              ))}
            </article>
          ) : (
            <div className="flex h-96 items-center justify-center text-center text-muted-foreground px-4">
              <div>
                <p className="font-semibold">No text yet</p>
                <p className="mt-1 text-sm">This novel chapter has no content available.</p>
              </div>
            </div>
          )
        ) : mode === "long_strip" ? (
          <div className="flex flex-col gap-1">
            {images.map((src, i) => (
              <img key={i} src={src} alt={`Page ${i + 1}`} className="w-full" loading={i < 2 ? "eager" : "lazy"} />
            ))}
          </div>
        ) : (
          <div>
            {images[page] && <img src={images[page]} alt={`Page ${page + 1}`} className="mx-auto w-full" />}
            <div className="mt-4 flex items-center justify-center gap-3">
              <Button variant="outline" size="icon" disabled={page === 0} onClick={() => setPage((p) => p - 1)}><ChevronLeft /></Button>
              <span className="font-mono text-sm">{page + 1} / {images.length}</span>
              <Button variant="outline" size="icon" disabled={page >= images.length - 1} onClick={() => setPage((p) => p + 1)}><ChevronRight /></Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
