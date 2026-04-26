import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Upload, Search, Sparkles, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TARGET_LANGUAGES, SOURCE_LANGUAGES, validateFile, timeAgo, typeLabel } from "@/lib/constants";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [from, setFrom] = useState("auto");
  const [to, setTo] = useState("en");
  const [search, setSearch] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const { data: latest } = useQuery({
    queryKey: ["latest-chapters"],
    queryFn: async () => {
      const { data } = await supabase
        .from("chapters")
        .select("id, chapter_number, release_date, series:series(slug, title, cover_url, type), translations(target_language, published)")
        .order("release_date", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  const { data: popular } = useQuery({
    queryKey: ["popular-series"],
    queryFn: async () => {
      const { data } = await supabase
        .from("series")
        .select("id, slug, title, cover_url, type, follow_count, rating")
        .eq("status", "ongoing")
        .order("follow_count", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  const { data: searchResults } = useQuery({
    queryKey: ["series-search", search],
    queryFn: async () => {
      if (search.trim().length < 2) return [];
      const { data } = await supabase
        .from("series")
        .select("slug, title, cover_url, type")
        .ilike("title", `%${search}%`)
        .limit(6);
      return data ?? [];
    },
    enabled: search.trim().length >= 2,
  });

  const handleFile = (f: File) => {
    const err = validateFile(f);
    if (err) { setFileError(err); setFile(null); return; }
    setFileError(null);
    setFile(f);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-5xl px-4 pt-12 pb-24">
        {/* Hero */}
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-glow-teal">
            Read any manga.<br />In any language. <span className="text-primary">Instantly.</span>
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            Upload a raw chapter — AI translates it in seconds.
          </p>
        </div>

        {/* Dropzone */}
        <label
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault(); setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
          className={`block cursor-pointer rounded-2xl border-2 border-dashed transition-all ${
            dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
          } ${file ? "border-primary bg-primary/5" : ""} p-12 text-center`}
        >
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.zip,.cbz,.pdf"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          <Upload className="mx-auto mb-4 h-10 w-10 text-primary" />
          {file ? (
            <>
              <p className="font-semibold text-foreground">{file.name}</p>
              <p className="text-sm text-muted-foreground mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB · ready to translate</p>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold">Drop your file here</p>
              <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
              <p className="text-xs text-muted-foreground mt-3">Supports: JPG · PNG · ZIP · CBZ · PDF</p>
            </>
          )}
        </label>
        {fileError && <p className="text-destructive text-sm mt-2 text-center">{fileError}</p>}

        {/* Language row */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Select value={from} onValueChange={setFrom}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SOURCE_LANGUAGES.map((l) => (
                <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <Select value={to} onValueChange={setTo}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TARGET_LANGUAGES.map((l) => (
                <SelectItem key={l.code} value={l.code}>{l.flag} {l.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button disabled={!file} className="font-semibold">
            <Sparkles className="h-4 w-4" /> Translate Now
          </Button>
        </div>

        {/* Search */}
        <div className="mt-12 max-w-xl mx-auto relative">
          <p className="text-sm text-muted-foreground mb-2 text-center">Or search for a series →</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search manga, manhwa, manhua..."
              className="w-full pl-10 pr-4 h-11 rounded-lg bg-card border border-border focus:border-primary outline-none transition-colors"
            />
          </div>
          {searchResults && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 rounded-lg border border-border bg-card overflow-hidden z-10">
              {searchResults.map((s) => (
                <Link
                  key={s.slug}
                  to="/series/$slug"
                  params={{ slug: s.slug }}
                  className="flex items-center gap-3 px-4 py-2 hover:bg-secondary transition-colors"
                  onClick={() => setSearch("")}
                >
                  <img src={s.cover_url ?? ""} alt="" className="h-10 w-7 object-cover rounded" />
                  <div>
                    <div className="font-medium text-sm">{s.title}</div>
                    <div className="text-xs text-muted-foreground">{typeLabel(s.type)}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Just Released */}
        <section className="mt-16">
          <div className="flex items-center gap-2 mb-5">
            <span className="h-2 w-2 rounded-full bg-success pulse-dot" />
            <h2 className="text-xl font-bold">Just Released</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {latest?.map((c: any) => {
              const hasEn = c.translations?.some((t: any) => t.target_language === "en" && t.published);
              return (
                <Link
                  key={c.id}
                  to="/translate/$slug/$chapter/$lang"
                  params={{ slug: c.series.slug, chapter: c.chapter_number, lang: "english" }}
                  className="group rounded-xl bg-card border border-border overflow-hidden hover:border-primary/50 transition-all"
                >
                  <div className="aspect-[3/4] overflow-hidden bg-secondary">
                    <img src={c.series.cover_url} alt={c.series.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                  </div>
                  <div className="p-3">
                    <div className="font-semibold text-sm truncate">{c.series.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Chapter {c.chapter_number}</div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-muted-foreground">{timeAgo(c.release_date)}</span>
                      <StatusBadge status={hasEn ? "translated" : "new"} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Popular */}
        <section className="mt-16">
          <h2 className="text-xl font-bold mb-5">Most Popular Ongoing</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {popular?.map((s: any) => (
              <Link
                key={s.id}
                to="/series/$slug"
                params={{ slug: s.slug }}
                className="group rounded-xl bg-card border border-border overflow-hidden hover:border-primary/50 transition-all"
              >
                <div className="aspect-[3/4] overflow-hidden bg-secondary relative">
                  <img src={s.cover_url} alt={s.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                  {s.rating && (
                    <span className="absolute bottom-2 left-2 bg-success text-background text-xs font-bold px-1.5 py-0.5 rounded">
                      {s.rating}
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <div className="font-semibold text-sm truncate">{s.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{typeLabel(s.type)}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
