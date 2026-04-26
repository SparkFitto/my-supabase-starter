import { createFileRoute, Link, useNavigate, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Sparkles, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TARGET_LANGUAGES, typeLabel } from "@/lib/constants";
import { useAuth } from "@/lib/auth";
import { getDeviceId } from "@/lib/device-id";

const SITE = "https://rawl.app";

export const Route = createFileRoute("/series/$slug/chapter/$chapter")({
  loader: async ({ params }) => {
    const { data: series } = await supabase.from("series").select("*").eq("slug", params.slug).maybeSingle();
    if (!series) throw notFound();
    const { data: chapter } = await supabase
      .from("chapters")
      .select("*, translations(id, target_language, published, page_count, upvotes, translator_username)")
      .eq("series_id", series.id)
      .eq("chapter_number", params.chapter)
      .maybeSingle();
    if (!chapter) throw notFound();
    return { series, chapter };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return {};
    const { series, chapter } = loaderData;
    const title = `${series.title} Chapter ${chapter.chapter_number} — Translate & Read | RAWL`;
    const desc = `Read ${series.title} chapter ${chapter.chapter_number} in English, Spanish, French, Portuguese, German, Russian, or Indonesian. AI translation in seconds.`;
    return {
      meta: [
        { title }, { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        ...(series.cover_url ? [{ property: "og:image", content: series.cover_url }] : []),
        { property: "og:type", content: "article" },
      ],
      links: [
        { rel: "canonical", href: `${SITE}/series/${params.slug}/chapter/${params.chapter}` },
        ...TARGET_LANGUAGES.map((l) => ({ rel: "alternate", hrefLang: l.code, href: `${SITE}/${l.code}/series/${params.slug}/chapter/${params.chapter}` })),
      ],
      scripts: [{
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ComicStory",
          name: `${series.title} Chapter ${chapter.chapter_number}`,
          partOfSeries: { "@type": "ComicSeries", name: series.title },
          datePublished: chapter.release_date,
          inLanguage: TARGET_LANGUAGES.map((l) => l.code),
        }),
      }],
    };
  },
  component: ChapterPage,
});

function ChapterPage() {
  const { series, chapter } = Route.useLoaderData();
  const { user, profile } = useAuth();
  const nav = useNavigate();
  const [target, setTarget] = useState(profile?.preferred_target_language ?? "en");
  const [translating, setTranslating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  type Trans = { id: string; target_language: string; published: boolean; page_count: number; upvotes: number; translator_username: string | null };
  const existing = ((chapter.translations ?? []) as Trans[]).filter((t) => t.published);
  const myExisting = existing.find((t) => t.target_language === target);

  const startTranslation = async () => {
    if (!user) { nav({ to: "/signin" }); return; }
    setTranslating(true); setErr(null);
    try {
      const { data: job, error: jobErr } = await supabase
        .from("jobs")
        .insert({
          user_id: user.id,
          chapter_id: chapter.id,
          target_language: target,
          source_language: series.source_language,
          device_id: getDeviceId(),
          status: "queued",
          progress: 0,
          current_step: "Queued",
        })
        .select("id")
        .single();
      if (jobErr || !job) throw jobErr ?? new Error("Failed to create job");

      const { error: invokeErr } = await supabase.functions.invoke("simulate-translation", {
        body: { jobId: job.id },
      });
      if (invokeErr) throw invokeErr;

      nav({ to: "/job/$jobId", params: { jobId: job.id } });
    } catch (e) {
      setErr((e as Error).message);
      setTranslating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Link to="/series/$slug" params={{ slug: series.slug }} className="font-mono text-xs uppercase text-muted-foreground hover:text-primary">
          ← {series.title}
        </Link>
        <h1 className="mt-2 text-3xl font-bold">Chapter {chapter.chapter_number}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{typeLabel(series.type)} · Released {chapter.release_date ? new Date(chapter.release_date).toLocaleDateString() : "—"}</p>

        {existing.length > 0 && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BookOpen className="h-5 w-5 text-primary" /> Already translated
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {existing.map((t) => {
                const lang = TARGET_LANGUAGES.find((l) => l.code === t.target_language);
                return (
                  <Button key={t.id} asChild variant="outline" size="sm">
                    <Link to="/read/$translationId" params={{ translationId: t.id }}>
                      {lang?.flag} {lang?.label ?? t.target_language} · {t.page_count}p
                    </Link>
                  </Button>
                );
              })}
            </CardContent>
          </Card>
        )}

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-primary" /> Translate to a new language
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TARGET_LANGUAGES.map((l) => (
                  <SelectItem key={l.code} value={l.code}>{l.flag} {l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {myExisting ? (
              <Button asChild className="w-full">
                <Link to="/read/$translationId" params={{ translationId: myExisting.id }}>Already done — open reader</Link>
              </Button>
            ) : (
              <Button onClick={startTranslation} disabled={translating} className="w-full">
                {translating ? "Starting…" : `Translate to ${TARGET_LANGUAGES.find((l) => l.code === target)?.label}`}
              </Button>
            )}
            {err && <p className="text-sm text-destructive">{err}</p>}
            {!user && <p className="text-xs text-muted-foreground">You'll need an account to start a translation.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
