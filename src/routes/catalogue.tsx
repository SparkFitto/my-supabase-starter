import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { SlidersHorizontal, Grid3x3, LayoutGrid, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { SERIES_TYPES, typeLabel } from "@/lib/constants";
import { useUserBookmarks, BOOKMARK_PILL } from "@/lib/use-bookmarks";
import { Bookmark } from "lucide-react";

const GENRES = ["Action","Adventure","Comedy","Drama","Fantasy","Romance","Sci-Fi","Slice of Life","Thriller","Horror","Mystery","Sports","Supernatural","Isekai","Cultivation"];
const STATUSES = ["ongoing","completed","hiatus"];

export const Route = createFileRoute("/catalogue")({
  head: () => ({
    meta: [
      { title: "Catalogue — Browse manga, manhwa & manhua | RAWL" },
      { name: "description", content: "Browse the full RAWL catalogue. Filter by genre, type, status, and language. Translate any series to your language." },
      { property: "og:title", content: "RAWL Catalogue" },
      { property: "og:description", content: "Every series. Any language." },
    ],
  }),
  component: CataloguePage,
});

function CataloguePage() {
  const { data: bookmarkMap = {} } = useUserBookmarks();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "dense">("grid");
  const [types, setTypes] = useState<string[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [sort, setSort] = useState<"popular" | "rating" | "newest">("popular");

  const { data: series, isLoading } = useQuery({
    queryKey: ["catalogue"],
    queryFn: async () => {
      const { data } = await supabase
        .from("series")
        .select("id, slug, title, cover_url, type, status, follow_count, rating, genres, release_year")
        .limit(200);
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    if (!series) return [];
    let r = series;
    if (search) r = r.filter((s) => s.title.toLowerCase().includes(search.toLowerCase()));
    if (types.length) r = r.filter((s) => types.includes(s.type));
    if (statuses.length) r = r.filter((s) => statuses.includes(s.status));
    if (genres.length) r = r.filter((s) => s.genres?.some((g) => genres.includes(g)));
    r = [...r].sort((a, b) => {
      if (sort === "popular") return b.follow_count - a.follow_count;
      if (sort === "rating") return (b.rating ?? 0) - (a.rating ?? 0);
      return (b.release_year ?? 0) - (a.release_year ?? 0);
    });
    return r;
  }, [series, search, types, genres, statuses, sort]);

  const toggle = (arr: string[], setArr: (v: string[]) => void, v: string) =>
    setArr(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const activeFilters = types.length + genres.length + statuses.length;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex flex-col gap-3">
          <h1 className="text-3xl font-bold">Catalogue</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Input placeholder="Search series…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline">
                  <SlidersHorizontal className="mr-2 h-4 w-4" /> Filters
                  {activeFilters > 0 && <Badge className="ml-2">{activeFilters}</Badge>}
                </Button>
              </SheetTrigger>
              <SheetContent className="overflow-y-auto">
                <SheetHeader><SheetTitle>Filters</SheetTitle></SheetHeader>
                <div className="mt-6 space-y-6">
                  <div>
                    <h3 className="mb-2 font-semibold">Type</h3>
                    <div className="space-y-2">
                      {SERIES_TYPES.map((t) => (
                        <label key={t.code} className="flex items-center gap-2 text-sm">
                          <Checkbox checked={types.includes(t.code)} onCheckedChange={() => toggle(types, setTypes, t.code)} />
                          {t.flag} {t.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-2 font-semibold">Status</h3>
                    <div className="space-y-2">
                      {STATUSES.map((s) => (
                        <label key={s} className="flex items-center gap-2 text-sm capitalize">
                          <Checkbox checked={statuses.includes(s)} onCheckedChange={() => toggle(statuses, setStatuses, s)} />
                          {s}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-2 font-semibold">Genre</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {GENRES.map((g) => (
                        <label key={g} className="flex items-center gap-2 text-sm">
                          <Checkbox checked={genres.includes(g)} onCheckedChange={() => toggle(genres, setGenres, g)} />
                          {g}
                        </label>
                      ))}
                    </div>
                  </div>
                  {activeFilters > 0 && (
                    <Button variant="outline" className="w-full" onClick={() => { setTypes([]); setGenres([]); setStatuses([]); }}>
                      <X className="mr-2 h-4 w-4" /> Clear all
                    </Button>
                  )}
                </div>
              </SheetContent>
            </Sheet>
            <div className="ml-auto flex gap-1">
              <Button size="icon" variant={view === "grid" ? "secondary" : "ghost"} onClick={() => setView("grid")}><LayoutGrid /></Button>
              <Button size="icon" variant={view === "dense" ? "secondary" : "ghost"} onClick={() => setView("dense")}><Grid3x3 /></Button>
            </div>
          </div>
          <div className="flex gap-2 text-xs">
            {(["popular", "rating", "newest"] as const).map((s) => (
              <button key={s} onClick={() => setSort(s)} className={`font-mono uppercase ${sort === s ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>{s}</button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="py-20 text-center text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">No series match your filters.</div>
        ) : (
          <div className={view === "grid"
            ? "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
            : "grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8"}>
            {filtered.map((s) => {
              const bm = bookmarkMap[s.id];
              const pill = bm ? BOOKMARK_PILL[bm] : null;
              return (
              <Link key={s.id} to="/series/$slug" params={{ slug: s.slug }} className="group">
                <div className="relative overflow-hidden rounded-lg bg-muted aspect-[2/3]">
                  {pill && (
                    <span className={`absolute top-1 left-1 z-10 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide shadow-md ${pill.classes}`}>
                      <Bookmark className="h-3 w-3 fill-current" />{pill.label}
                    </span>
                  )}
                  {s.cover_url ? (
                    <img src={s.cover_url} alt={s.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
                  ) : <div className="h-full w-full bg-secondary" />}
                </div>
                <p className={`mt-2 line-clamp-2 ${view === "grid" ? "text-sm" : "text-xs"} font-medium`}>{s.title}</p>
                {view === "grid" && <p className="font-mono text-xs text-muted-foreground">{typeLabel(s.type)}</p>}
              </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
