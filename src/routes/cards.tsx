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

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-[168px] w-[120px] animate-pulse rounded-xl bg-secondary" />
            ))}
          </div>
        ) : cards.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <p className="text-2xl">🎴</p>
            <p>No cards found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 justify-items-center gap-3 sm:grid-cols-4 md:grid-cols-5">
            {cards.map((c) => (
              <CardDisplay key={c.id} card={c} onClick={() => setOpenCardId(c.id)} />
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
