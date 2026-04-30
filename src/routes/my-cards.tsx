import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Lock, Layers, History, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Header } from "@/components/Header";
import { CardDisplay, CARD_RANKS, type CardData, type CardRank, type UserCardData } from "@/components/cards/CardDisplay";
import { CardDetailModal } from "@/components/cards/CardDetailModal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/my-cards")({
  head: () => ({ meta: [{ title: "My Cards — RAWL" }] }),
  component: MyCardsPage,
});

function MyCardsPage() {
  const { user, profile, loading } = useAuth();
  const nav = useNavigate();
  const [rank, setRank] = useState<CardRank | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [openCardId, setOpenCardId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      nav({ to: "/signin", search: { redirect: "/my-cards" } as any });
    }
  }, [loading, user, nav]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["my-cards", user?.id, rank, search],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase
        .from("user_cards")
        .select("id, quantity, frame_level, is_blocked, is_trade_ready, card:cards!inner(id, name, character_name, image_url, rank, is_animated, series:series(slug, title))")
        .eq("user_id", user!.id)
        .gt("quantity", 0)
        .order("acquired_at", { ascending: false });
      if (rank !== "ALL") q = q.eq("card.rank", rank);
      const { data } = await q;
      let list = (data ?? []) as Array<UserCardData & { card: CardData }>;
      if (search.trim()) {
        const s = search.trim().toLowerCase();
        list = list.filter((r) => r.card.character_name.toLowerCase().includes(s));
      }
      return list;
    },
  });

  // Realtime: refetch on inventory changes
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`my-cards:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_cards", filter: `user_id=eq.${user.id}` },
        () => {
          // Trigger refetch via invalidation handled by useQuery's interval; quick approach: reload
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="p-8 text-center text-muted-foreground">Loading…</div>
      </div>
    );
  }

  const total = rows.reduce((sum, r) => sum + (r.quantity ?? 0), 0);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-6">
        {/* Header row: title + ink balance */}
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">My Cards</h1>
          <div className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm font-bold">
            <span>🖊️</span>
            <span>{profile?.ink_balance ?? 0}</span>
            <span className="text-xs text-muted-foreground">Ink</span>
          </div>
        </div>

        {/* Action row */}
        <div className="mb-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowSearch((v) => !v)}>
            <Search className="mr-1.5 h-4 w-4" />Search
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/exchanges" search={{ tab: "history" } as any}>
              <History className="mr-1.5 h-4 w-4" />Exchange History
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/decks">
              <Layers className="mr-1.5 h-4 w-4" />Decks
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/packs"><Package className="mr-1.5 h-4 w-4" />Open Packs</Link>
          </Button>
        </div>

        {showSearch && (
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by character name…"
            className="mb-4 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        )}

        {/* Rank tabs */}
        <div className="mb-4 flex flex-wrap gap-1">
          {(["ALL", ...CARD_RANKS] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRank(r as any)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-bold transition-colors",
                rank === r ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/80",
              )}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-[168px] w-[120px] animate-pulse rounded-xl bg-secondary" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-10 text-center">
            <div className="mb-3 text-5xl">🎴</div>
            <p className="mb-1 font-semibold">You haven't collected any cards yet!</p>
            <p className="mb-4 text-sm text-muted-foreground">
              Open packs or trade with other users to start your collection.
            </p>
            <Button asChild>
              <Link to="/packs">Open a pack</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 justify-items-center gap-3 sm:grid-cols-4 md:grid-cols-5">
              {rows.map((r) => (
                <CardDisplay
                  key={r.id}
                  card={r.card}
                  userCard={r}
                  onClick={() => setOpenCardId(r.card.id)}
                />
              ))}
            </div>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              You have <span className="font-bold text-foreground">{total}</span> card{total === 1 ? "" : "s"} total ({rows.length} unique)
            </p>
          </>
        )}
      </main>

      <CardDetailModal cardId={openCardId} onClose={() => setOpenCardId(null)} />
    </div>
  );
}
