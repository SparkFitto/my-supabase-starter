import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Star, Calendar, Tag, Heart, ChevronDown, BookOpen, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { typeLabel, formatDate, TARGET_LANGUAGES } from "@/lib/constants";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

const SITE = "https://rawl.app";

export const Route = createFileRoute("/series/$slug")({
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("series")
      .select("*")
      .eq("slug", params.slug)
      .maybeSingle();
    if (!data) throw notFound();
    return { series: data };
  },
  head: ({ loaderData }) => {
    const s = loaderData?.series;
    if (!s) return {};
    const title = `${s.title} — Read in any language | RAWL`;
    const desc = (s.description ?? `Translate and read ${s.title} ${typeLabel(s.type)} chapters in 7 languages — instantly.`).slice(0, 158);
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        ...(s.cover_url ? [{ property: "og:image", content: s.cover_url }, { property: "twitter:image", content: s.cover_url }] : []),
        { property: "og:type", content: "book" },
      ],
      links: [
        { rel: "canonical", href: `${SITE}/series/${s.slug}` },
        ...TARGET_LANGUAGES.map((l) => ({ rel: "alternate", hrefLang: l.code, href: `${SITE}/${l.code}/series/${s.slug}` })),
      ],
      scripts: [{
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ComicSeries",
          name: s.title,
          alternateName: s.alt_titles ?? [],
          description: s.description,
          image: s.cover_url,
          genre: s.genres,
          datePublished: s.release_year ? `${s.release_year}-01-01` : undefined,
          aggregateRating: s.rating ? { "@type": "AggregateRating", ratingValue: s.rating, ratingCount: s.follow_count } : undefined,
        }),
      }],
    };
  },
  component: SeriesPage,
  notFoundComponent: () => (
    <div className="min-h-screen bg-background"><Header />
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-3xl font-bold">Series not found</h1>
        <p className="mt-2 text-muted-foreground">We don't have this series catalogued yet.</p>
        <Button asChild className="mt-6"><Link to="/catalogue">Browse catalogue</Link></Button>
      </div>
    </div>
  ),
});

function SeriesPage() {
  const { series } = Route.useLoaderData();
  const { user } = useAuth();
  const [showAll, setShowAll] = useState(false);

  const { data: chapters } = useQuery({
    queryKey: ["chapters", series.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("chapters")
        .select("id, chapter_number, volume_number, release_date, translations(id, target_language, published, page_count, upvotes)")
        .eq("series_id", series.id)
        .order("release_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: fav, refetch: refetchFav } = useQuery({
    queryKey: ["fav", series.id, user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("favorites").select("series_id").eq("user_id", user.id).eq("series_id", series.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const toggleFav = async () => {
    if (!user) return;
    if (fav) await supabase.from("favorites").delete().eq("user_id", user.id).eq("series_id", series.id);
    else await supabase.from("favorites").insert({ user_id: user.id, series_id: series.id });
    refetchFav();
  };

  const visible = showAll ? chapters : chapters?.slice(0, 20);

  const { data: glossary, refetch: refetchGlossary } = useQuery({
    queryKey: ["glossary", series.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("series_glossary")
        .select("id, original_term, translated_term, target_language")
        .eq("series_id", series.id)
        .eq("approved", true)
        .order("original_term");
      return data ?? [];
    },
  });

  const [orig, setOrig] = useState("");
  const [trans, setTrans] = useState("");
  const [lang, setLang] = useState("en");

  const submitGlossary = async () => {
    if (!user) { toast.error("Sign in to suggest a term"); return; }
    if (!orig.trim() || !trans.trim()) { toast.error("Fill both fields"); return; }
    const { error } = await supabase.from("series_glossary").insert({
      series_id: series.id, original_term: orig.trim(), translated_term: trans.trim(),
      target_language: lang, suggested_by: user.id,
    });
    if (error) toast.error(error.message);
    else { toast.success("Submitted for review"); setOrig(""); setTrans(""); refetchGlossary(); }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="relative">
        {series.cover_url && (
          <div className="absolute inset-0 -z-10 h-80 overflow-hidden">
            <img src={series.cover_url} alt="" className="h-full w-full object-cover blur-2xl opacity-30" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
          </div>
        )}
        <div className="mx-auto max-w-7xl px-4 pt-12 pb-8">
          <div className="flex flex-col gap-6 md:flex-row">
            <div className="w-48 shrink-0">
              {series.cover_url ? (
                <img src={series.cover_url} alt={series.title} className="aspect-[2/3] w-full rounded-lg object-cover shadow-2xl" />
              ) : <div className="aspect-[2/3] w-full rounded-lg bg-muted" />}
            </div>
            <div className="flex-1">
              <Badge variant="secondary" className="mb-2 font-mono">{typeLabel(series.type)}</Badge>
              <h1 className="text-3xl font-bold md:text-4xl">{series.title}</h1>
              {series.alt_titles && series.alt_titles.length > 0 && (
                <p className="mt-1 text-sm text-muted-foreground">{series.alt_titles.join(" · ")}</p>
              )}
              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                {series.rating && <span className="flex items-center gap-1"><Star className="h-4 w-4 text-warning" />{series.rating}</span>}
                {series.release_year && <span className="flex items-center gap-1 text-muted-foreground"><Calendar className="h-4 w-4" />{series.release_year}</span>}
                <span className="flex items-center gap-1 text-muted-foreground"><Heart className="h-4 w-4" />{series.follow_count.toLocaleString()}</span>
                <Badge>{series.status}</Badge>
              </div>
              {series.genres && series.genres.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {series.genres.map((g: string) => <Badge key={g} variant="outline" className="font-normal"><Tag className="mr-1 h-3 w-3" />{g}</Badge>)}
                </div>
              )}
              {series.description && <p className="mt-4 text-sm text-foreground/80">{series.description}</p>}
              <div className="mt-6 flex gap-3">
                <Button onClick={toggleFav} variant={fav ? "secondary" : "default"} disabled={!user}>
                  <Heart className={`mr-2 h-4 w-4 ${fav ? "fill-current" : ""}`} />
                  {fav ? "Following" : "Follow"}
                </Button>
              </div>
            </div>
          </div>

          <section className="mt-12">
            <h2 className="mb-4 text-xl font-semibold">Chapters</h2>
            <div className="rounded-lg border border-border">
              {visible?.map((ch) => {
                const langs = (ch.translations ?? []).filter((t) => t.published);
                return (
                  <div key={ch.id} className="flex items-center justify-between border-b border-border px-4 py-3 last:border-b-0">
                    <Link to="/series/$slug/chapter/$chapter" params={{ slug: series.slug, chapter: ch.chapter_number }} className="flex-1 hover:text-primary">
                      <p className="font-medium">Chapter {ch.chapter_number}</p>
                      <p className="font-mono text-xs text-muted-foreground">{formatDate(ch.release_date)}</p>
                    </Link>
                    <div className="flex flex-wrap gap-1">
                      {langs.length === 0 ? (
                        <Badge variant="outline" className="font-mono text-xs">No translation</Badge>
                      ) : langs.map((t) => (
                        <Link key={t.id} to="/read/$translationId" params={{ translationId: t.id }} className="rounded bg-muted px-2 py-0.5 font-mono text-xs hover:bg-primary hover:text-primary-foreground">
                          {t.target_language.toUpperCase()}
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
              {!chapters?.length && <p className="p-6 text-center text-sm text-muted-foreground">No chapters yet — be the first to translate one!</p>}
            </div>
            {chapters && chapters.length > 20 && !showAll && (
              <Button variant="outline" className="mt-4 w-full" onClick={() => setShowAll(true)}>
                Show all {chapters.length} <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            )}
          </section>

          <section className="mt-12">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold"><BookOpen className="h-5 w-5" />Glossary</h2>
            {glossary && glossary.length > 0 ? (
              <div className="grid gap-2 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
                {glossary.map((g) => (
                  <div key={g.id} className="flex items-center justify-between gap-2 text-sm">
                    <span><span className="font-medium">{g.original_term}</span> → <span className="text-primary">{g.translated_term}</span></span>
                    <Badge variant="outline" className="font-mono text-xs">{g.target_language.toUpperCase()}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No approved glossary terms yet.</p>
            )}
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="mb-3 text-sm font-medium">Suggest a term</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input placeholder="Original term" value={orig} onChange={(e) => setOrig(e.target.value)} />
                <Input placeholder="Translation" value={trans} onChange={(e) => setTrans(e.target.value)} />
                <select value={lang} onChange={(e) => setLang(e.target.value)} className="rounded-md border border-input bg-transparent px-3 text-sm">
                  {TARGET_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.code.toUpperCase()}</option>)}
                </select>
                <Button onClick={submitGlossary}><Plus className="mr-1 h-4 w-4" />Submit</Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Suggestions are reviewed by admins before appearing publicly.</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
