import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShoppingBag, Tag, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CARD_RANKS } from "@/components/cards/CardDisplay";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/marketplace")({
  head: () => ({ meta: [{ title: "Marketplace — RAWL" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    tab: (search.tab as string) ?? "lots",
  }),
  component: MarketplacePage,
});

function MarketplacePage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const { tab } = Route.useSearch();
  const qc = useQueryClient();

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel("marketplace-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "card_lots" }, () => {
        qc.invalidateQueries({ queryKey: ["lots"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "card_requests" }, () => {
        qc.invalidateQueries({ queryKey: ["requests"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  if (loading) {
    return <div className="min-h-screen bg-background"><Header /><div className="p-8 text-center">Loading…</div></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Marketplace</h1>
          <Button variant="outline" size="sm" asChild><Link to="/my-cards">My Cards</Link></Button>
        </div>
        <Tabs value={tab} onValueChange={(v) => nav({ to: "/marketplace", search: { tab: v } as any })}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="lots"><ShoppingBag className="mr-1.5 h-4 w-4" />Buy</TabsTrigger>
            <TabsTrigger value="requests"><Tag className="mr-1.5 h-4 w-4" />Sell</TabsTrigger>
          </TabsList>
          <TabsContent value="lots" className="mt-6">
            <LotsTab userId={user?.id ?? null} />
          </TabsContent>
          <TabsContent value="requests" className="mt-6">
            <RequestsTab userId={user?.id ?? null} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function LotsTab({ userId }: { userId: string | null }) {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const { data: lots = [] } = useQuery({
    queryKey: ["lots"],
    queryFn: async () => {
      const { data } = await supabase
        .from("card_lots")
        .select("id, price_rank, price_amount, status, created_at, seller_id, card:cards!inner(id, name, character_name, image_url, rank), seller:user_profiles!card_lots_seller_id_fkey(username, avatar_url)")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const remove = async (id: string) => {
    await supabase.from("card_lots").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["lots"] });
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={() => setShowCreate((v) => !v)} disabled={!userId}>
          {showCreate ? "Cancel" : "+ Create lot"}
        </Button>
      </div>
      {showCreate && userId && <CreateLotForm userId={userId} onCreated={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ["lots"] }); }} />}
      {lots.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No active lots. Be the first to list a card!</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lots.map((l: any) => (
            <div key={l.id} className="flex gap-3 rounded-lg border border-border bg-card p-3">
              <img src={l.card.image_url} alt={l.card.character_name} className="h-24 w-16 rounded object-cover" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="rounded bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">{l.card.rank}</span>
                  <p className="truncate text-sm font-bold">{l.card.character_name}</p>
                </div>
                <p className="text-xs text-muted-foreground">@{l.seller?.username}</p>
                <p className="mt-2 text-sm font-bold">Price: {l.price_amount} <span className="text-xs">{l.price_rank} card{l.price_amount === 1 ? "" : "s"}</span></p>
                {l.seller_id === userId && (
                  <button onClick={() => remove(l.id)} className="mt-1 text-xs text-destructive hover:underline">
                    <Trash2 className="mr-0.5 inline h-3 w-3" />Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateLotForm({ userId, onCreated }: { userId: string; onCreated: () => void }) {
  const { data: myCards = [] } = useQuery({
    queryKey: ["my-cards-for-lot", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_cards")
        .select("id, card_id, quantity, card:cards!inner(id, character_name, image_url, rank)")
        .eq("user_id", userId).gt("quantity", 0).eq("is_blocked", false);
      return data ?? [];
    },
  });
  const [cardId, setCardId] = useState("");
  const [priceRank, setPriceRank] = useState("C");
  const [priceAmount, setPriceAmount] = useState(10);

  const submit = async () => {
    if (!cardId) { toast.error("Pick a card"); return; }
    const { error } = await supabase.from("card_lots").insert({
      seller_id: userId, card_id: cardId, price_rank: priceRank, price_amount: priceAmount, status: "active",
    });
    if (error) toast.error(error.message);
    else { toast.success("Lot listed"); onCreated(); }
  };

  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-bold">Create new lot</h3>
      <div className="space-y-2">
        <select value={cardId} onChange={(e) => setCardId(e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm">
          <option value="">— Select a card —</option>
          {myCards.map((c: any) => (
            <option key={c.id} value={c.card_id}>[{c.card.rank}] {c.card.character_name} (×{c.quantity})</option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            type="number" min={1} value={priceAmount}
            onChange={(e) => setPriceAmount(parseInt(e.target.value) || 1)}
            className="w-24 rounded border border-border bg-background px-2 py-1.5 text-sm"
            placeholder="Amount"
          />
          <select value={priceRank} onChange={(e) => setPriceRank(e.target.value)} className="rounded border border-border bg-background px-2 py-1.5 text-sm">
            {CARD_RANKS.map((r) => <option key={r} value={r}>{r} cards</option>)}
          </select>
          <Button size="sm" onClick={submit}>List</Button>
        </div>
      </div>
    </div>
  );
}

function RequestsTab({ userId }: { userId: string | null }) {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const { data: requests = [] } = useQuery({
    queryKey: ["requests"],
    queryFn: async () => {
      const { data } = await supabase
        .from("card_requests")
        .select("id, offer_rank, offer_amount, status, created_at, buyer_id, card:cards!inner(id, character_name, image_url, rank), buyer:user_profiles!card_requests_buyer_id_fkey(username, avatar_url)")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const remove = async (id: string) => {
    await supabase.from("card_requests").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["requests"] });
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={() => setShowCreate((v) => !v)} disabled={!userId}>
          {showCreate ? "Cancel" : "+ Post request"}
        </Button>
      </div>
      {showCreate && userId && <CreateRequestForm userId={userId} onCreated={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ["requests"] }); }} />}
      {requests.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No active buy requests.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {requests.map((r: any) => (
            <div key={r.id} className="flex gap-3 rounded-lg border border-border bg-card p-3">
              <img src={r.card.image_url} alt={r.card.character_name} className="h-24 w-16 rounded object-cover" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="rounded bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">{r.card.rank}</span>
                  <p className="truncate text-sm font-bold">{r.card.character_name}</p>
                </div>
                <p className="text-xs text-muted-foreground">@{r.buyer?.username}</p>
                <p className="mt-2 text-sm">Offers: <span className="font-bold">{r.offer_amount} {r.offer_rank} card{r.offer_amount === 1 ? "" : "s"}</span></p>
                {r.buyer_id === userId && (
                  <button onClick={() => remove(r.id)} className="mt-1 text-xs text-destructive hover:underline">
                    <Trash2 className="mr-0.5 inline h-3 w-3" />Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateRequestForm({ userId, onCreated }: { userId: string; onCreated: () => void }) {
  const [search, setSearch] = useState("");
  const [cardId, setCardId] = useState("");
  const [offerRank, setOfferRank] = useState("C");
  const [offerAmount, setOfferAmount] = useState(10);

  const { data: hits = [] } = useQuery({
    queryKey: ["card-search", search],
    enabled: search.length >= 2,
    queryFn: async () => {
      const { data } = await supabase.from("cards")
        .select("id, character_name, rank")
        .ilike("character_name", `%${search}%`).eq("is_approved", true).limit(8);
      return data ?? [];
    },
  });

  const submit = async () => {
    if (!cardId) { toast.error("Pick a card"); return; }
    const { error } = await supabase.from("card_requests").insert({
      buyer_id: userId, card_id: cardId, offer_rank: offerRank, offer_amount: offerAmount, status: "open",
    });
    if (error) toast.error(error.message);
    else { toast.success("Request posted"); onCreated(); }
  };

  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-bold">Post buy request</h3>
      <div className="space-y-2">
        <input value={search} onChange={(e) => { setSearch(e.target.value); setCardId(""); }} placeholder="Search card by character name…" className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm" />
        {hits.length > 0 && !cardId && (
          <div className="max-h-40 overflow-y-auto rounded border border-border">
            {hits.map((c: any) => (
              <button key={c.id} onClick={() => { setCardId(c.id); setSearch(c.character_name); }} className={cn("block w-full px-2 py-1 text-left text-sm hover:bg-secondary", cardId === c.id && "bg-primary/20")}>
                [{c.rank}] {c.character_name}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input type="number" min={1} value={offerAmount} onChange={(e) => setOfferAmount(parseInt(e.target.value) || 1)} className="w-24 rounded border border-border bg-background px-2 py-1.5 text-sm" />
          <select value={offerRank} onChange={(e) => setOfferRank(e.target.value)} className="rounded border border-border bg-background px-2 py-1.5 text-sm">
            {CARD_RANKS.map((r) => <option key={r} value={r}>{r}-shards</option>)}
          </select>
          <Button size="sm" onClick={submit}>Post</Button>
        </div>
      </div>
    </div>
  );
}
