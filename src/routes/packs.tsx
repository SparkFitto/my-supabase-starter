import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { CardDisplay, type CardData } from "@/components/cards/CardDisplay";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/packs")({
  head: () => ({ meta: [{ title: "Open Packs — RAWL" }] }),
  component: PacksPage,
});

type Phase = "idle" | "opening" | "reveal" | "choose" | "done";

function PacksPage() {
  const { user, profile, loading } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [phase, setPhase] = useState<Phase>("idle");
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [cardIds, setCardIds] = useState<string[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/signin", search: { redirect: "/packs" } as any });
  }, [loading, user, nav]);

  const { data: cards = [] } = useQuery({
    queryKey: ["pack-cards", cardIds],
    enabled: cardIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("cards")
        .select("id, name, character_name, image_url, rank, is_animated, series:series(slug, title)")
        .in("id", cardIds);
      // Preserve order
      const map = new Map((data ?? []).map((c) => [c.id, c]));
      return cardIds.map((id) => map.get(id)).filter(Boolean) as CardData[];
    },
  });

  const ink = profile?.ink_balance ?? 0;
  const canAfford = ink >= 55;

  const openPack = async () => {
    if (!canAfford) { toast.error("Not enough Ink"); return; }
    setPhase("opening");
    const { data, error } = await supabase.rpc("open_pack");
    if (error) { toast.error(error.message); setPhase("idle"); return; }
    const row = (data as any)?.[0] ?? data;
    if (!row?.opening_id || !row?.card_ids) { toast.error("Pack failed"); setPhase("idle"); return; }
    setOpeningId(row.opening_id);
    setCardIds(row.card_ids);
    qc.invalidateQueries({ queryKey: ["auth-profile"] });
    setTimeout(() => setPhase("reveal"), 900);
    setTimeout(() => setPhase("choose"), 2400);
  };

  const pickCard = async (cardId: string) => {
    if (!openingId || phase !== "choose") return;
    setChosen(cardId);
    const { error } = await supabase.rpc("pack_select_card", { _opening_id: openingId, _card_id: cardId });
    if (error) { toast.error(error.message); return; }
    setPhase("done");
    qc.invalidateQueries({ queryKey: ["my-cards"] });
    toast.success("Card added to your collection!");
  };

  const reset = () => {
    setPhase("idle");
    setOpeningId(null);
    setCardIds([]);
    setChosen(null);
  };

  if (loading || !user) {
    return <div className="min-h-screen bg-background"><Header /><div className="p-8 text-center text-muted-foreground">Loading…</div></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Card Packs</h1>
          <div className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm font-bold">
            <span>🖊️</span><span>{ink}</span>
            <span className="text-xs text-muted-foreground">Ink</span>
          </div>
        </div>

        {phase === "idle" && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <div className="mx-auto mb-4 flex h-32 w-24 items-center justify-center rounded-xl border-2 border-primary bg-gradient-to-br from-primary/30 to-purple-500/30 text-5xl shadow-lg">
              <Package className="h-12 w-12 text-primary" />
            </div>
            <h2 className="mb-1 text-xl font-bold">Standard Pack</h2>
            <p className="mb-4 text-sm text-muted-foreground">3 cards revealed. Choose 1 to keep.</p>
            <p className="mb-6 text-xs text-muted-foreground">Pity: S-tier guaranteed at 50 packs · X-tier at 150 packs</p>
            <Button size="lg" onClick={openPack} disabled={!canAfford}>
              <Sparkles className="mr-2 h-5 w-5" />
              Open Pack — 55 Ink
            </Button>
            {!canAfford && <p className="mt-2 text-xs text-destructive">You need {55 - ink} more Ink</p>}
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="outline" size="sm" asChild><Link to="/my-cards">My Cards</Link></Button>
              <Button variant="outline" size="sm" asChild><Link to="/cards">Catalog</Link></Button>
            </div>
          </div>
        )}

        {phase === "opening" && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="relative h-40 w-32 animate-pulse">
              <div className="absolute inset-0 animate-ping rounded-xl bg-primary/30" />
              <div className="relative flex h-full w-full items-center justify-center rounded-xl border-2 border-primary bg-gradient-to-br from-primary/40 to-purple-500/40 shadow-2xl">
                <Sparkles className="h-12 w-12 animate-spin text-primary" />
              </div>
            </div>
            <p className="mt-6 text-lg font-bold">Opening pack…</p>
          </div>
        )}

        {(phase === "reveal" || phase === "choose" || phase === "done") && cards.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="mb-1 text-center text-xl font-bold">
              {phase === "reveal" && "Revealing…"}
              {phase === "choose" && "Choose 1 card to keep"}
              {phase === "done" && "🎉 Card added!"}
            </h2>
            <p className="mb-6 text-center text-sm text-muted-foreground">
              {phase === "choose" && "The other 2 will be lost forever."}
              {phase === "done" && "The unchosen cards have been discarded."}
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              {cards.map((card, i) => {
                const isChosen = chosen === card.id;
                const isFaded = phase === "done" && !isChosen;
                return (
                  <div
                    key={card.id}
                    className={cn(
                      "transition-all duration-500",
                      phase === "reveal" && "animate-in fade-in slide-in-from-bottom-4",
                      isFaded && "scale-90 opacity-30 grayscale",
                      isChosen && "scale-110",
                    )}
                    style={phase === "reveal" ? { animationDelay: `${i * 200}ms` } : undefined}
                  >
                    <CardDisplay
                      card={card}
                      size="lg"
                      onClick={phase === "choose" ? () => pickCard(card.id) : undefined}
                    />
                  </div>
                );
              })}
            </div>
            {phase === "done" && (
              <div className="mt-8 flex justify-center gap-3">
                <Button onClick={reset} disabled={!canAfford}>
                  <Sparkles className="mr-2 h-4 w-4" />Open Another
                </Button>
                <Button variant="outline" asChild><Link to="/my-cards">View Collection</Link></Button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
