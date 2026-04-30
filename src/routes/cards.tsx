import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { CardDisplay, CARD_RANKS, type CardData, type CardRank } from "@/components/cards/CardDisplay";
import { CardDetailModal } from "@/components/cards/CardDetailModal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cards")({
  head: () => ({
    meta: [
      { title: "Card Catalog — RAWL" },
      { name: "description", content: "Browse the full RAWL card catalog. Collect, trade, and complete your set." },
      { property: "og:title", content: "Card Catalog — RAWL" },
      { property: "og:description", content: "Browse the full RAWL card catalog." },
    ],
  }),
  component: CardCatalogPage,
});

const PAGE_SIZE = 50;

function CardCatalogPage() {
  const [rank, setRank] = useState<CardRank | "ALL">("ALL");
  const [tag, setTag] = useState<string>("");
  const [page, setPage] = useState(1);
  const [openCardId, setOpenCardId] = useState<string | null>(null);

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["cards-catalog", rank, tag, page],
    queryFn: async () => {
      let q = supabase
        .from("cards")
        .select("id, name, character_name, image_url, rank, is_animated, tags, series:series(slug, title)")
        .eq("is_approved", true)
        .order("created_at", { ascending: false })
        .range(0, page * PAGE_SIZE - 1);
      if (rank !== "ALL") q = q.eq("rank", rank);
      if (tag) q = q.contains("tags", [tag]);
      const { data } = await q;
      return (data ?? []) as (CardData & { tags: string[] })[];
    },
  });

  const { data: allTags = [] } = useQuery({
    queryKey: ["card-tags"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cards")
        .select("tags")
        .eq("is_approved", true)
        .limit(500);
      const set = new Set<string>();
      (data ?? []).forEach((row: any) => (row.tags ?? []).forEach((t: string) => set.add(t)));
      return Array.from(set).sort();
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="mb-1 text-center text-3xl font-bold">Card Catalog</h1>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          Collect cards by reading, trading, and opening packs.
        </p>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {/* Rank tabs */}
          <div className="flex flex-wrap gap-1">
            {(["ALL", ...CARD_RANKS] as const).map((r) => (
              <button
                key={r}
                onClick={() => { setRank(r as any); setPage(1); }}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-bold transition-colors",
                  rank === r ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/80",
                )}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Tag filter */}
          <select
            value={tag}
            onChange={(e) => { setTag(e.target.value); setPage(1); }}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          >
            <option value="">All tags</option>
            {allTags.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Grid — fluid: each card takes a generous slice on phones (2 cols), more on larger */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] w-full animate-pulse rounded-xl bg-secondary" />
            ))}
          </div>
        ) : cards.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <p className="text-2xl">🎴</p>
            <p>No cards found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {cards.map((c) => (
              <FluidCard key={c.id} card={c} onClick={() => setOpenCardId(c.id)} />
            ))}
          </div>
        )}

        {cards.length >= page * PAGE_SIZE && (
          <div className="mt-6 flex justify-center">
            <Button variant="outline" onClick={() => setPage((p) => p + 1)}>Load more</Button>
          </div>
        )}
      </main>

      <CardDetailModal cardId={openCardId} onClose={() => setOpenCardId(null)} />
    </div>
  );
}

// Wrapper that lets a card fill its grid cell on mobile (instead of fixed 120px)
function FluidCard({ card, onClick }: { card: CardData; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative aspect-[2/3] w-full overflow-hidden rounded-xl border-2 bg-secondary transition-transform hover:scale-[1.02] active:scale-[0.98]"
      style={{ borderColor: rankBorderColor(card.rank) }}
    >
      <img src={card.image_url} alt={card.character_name} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
      <div
        className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white shadow-md"
        style={{ background: rankBorderColor(card.rank), color: ["X","T","L","Q"].includes(card.rank) ? "#000" : "#fff" }}
      >
        {card.rank}
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent px-2 py-1.5 text-left">
        <div className="truncate text-xs font-bold text-white">{card.character_name}</div>
        {card.series?.title && <div className="truncate text-[10px] text-white/60">{card.series.title}</div>}
      </div>
    </button>
  );
}

function rankBorderColor(r: string) {
  const map: Record<string, string> = {
    X: "#2dd4bf", S: "#a855f7", A: "#b91c1c", B: "#ec4899", C: "#ca8a04",
    D: "#57534e", E: "#78350f", F: "#3b82f6", G: "#16a34a",
    T: "#facc15", H: "#fb7185", N: "#38bdf8", V: "#a78bfa", L: "#a3e635", K: "#e879f9", Q: "#fb923c",
  };
  return map[r] ?? "#666";
}
