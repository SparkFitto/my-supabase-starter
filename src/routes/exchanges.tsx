import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, Check, X, Flame, Scissors } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/notify";

export const Route = createFileRoute("/exchanges")({
  head: () => ({ meta: [{ title: "Exchanges — RAWL" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    tab: (search.tab as string) ?? "offers",
  }),
  component: ExchangesPage,
});

function ExchangesPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const { tab } = Route.useSearch();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !user) nav({ to: "/signin", search: { redirect: "/exchanges" } as any });
  }, [loading, user, nav]);

  // Realtime: refetch trades on any change
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`exchanges:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "card_trades" }, () => {
        qc.invalidateQueries({ queryKey: ["trades-incoming"] });
        qc.invalidateQueries({ queryKey: ["trades-outgoing"] });
        qc.invalidateQueries({ queryKey: ["trades-history"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, qc]);

  if (loading || !user) {
    return <div className="min-h-screen bg-background"><Header /><div className="p-8 text-center text-muted-foreground">Loading…</div></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-6">
        <h1 className="mb-6 text-2xl font-bold">Exchanges</h1>
        <Tabs value={tab} onValueChange={(v) => nav({ to: "/exchanges", search: { tab: v } as any })}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="offers"><ArrowLeftRight className="mr-1.5 h-4 w-4" />Offers</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="smelt"><Flame className="mr-1.5 h-4 w-4" />Upgrade</TabsTrigger>
            <TabsTrigger value="split"><Scissors className="mr-1.5 h-4 w-4" />Split</TabsTrigger>
          </TabsList>

          <TabsContent value="offers" className="mt-6">
            <OffersTab userId={user.id} />
          </TabsContent>
          <TabsContent value="history" className="mt-6">
            <HistoryTab userId={user.id} />
          </TabsContent>
          <TabsContent value="smelt" className="mt-6">
            <SmeltTab userId={user.id} />
          </TabsContent>
          <TabsContent value="split" className="mt-6">
            <SplitTab userId={user.id} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function OffersTab({ userId }: { userId: string }) {
  const qc = useQueryClient();

  const { data: incoming = [] } = useQuery({
    queryKey: ["trades-incoming", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("card_trades")
        .select("id, sender_id, receiver_id, sender_cards, receiver_cards, message, status, created_at, sender:user_profiles!card_trades_sender_id_fkey(username, avatar_url)")
        .eq("receiver_id", userId).eq("status", "pending")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: outgoing = [] } = useQuery({
    queryKey: ["trades-outgoing", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("card_trades")
        .select("id, sender_id, receiver_id, sender_cards, receiver_cards, message, status, created_at, receiver:user_profiles!card_trades_receiver_id_fkey(username, avatar_url)")
        .eq("sender_id", userId).eq("status", "pending")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const accept = async (id: string) => {
    const { data: trade } = await supabase.from("card_trades").select("sender_id").eq("id", id).maybeSingle();
    const { error } = await supabase.rpc("accept_trade", { _trade_id: id });
    if (error) toast.error(error.message);
    else {
      toast.success("Trade accepted");
      qc.invalidateQueries({ queryKey: ["my-cards"] });
      if (trade?.sender_id) {
        notify({ user_id: trade.sender_id, type: "trade_accepted", title: "Trade accepted ✅", body: "Your trade was accepted!", link: "/exchanges" });
      }
    }
  };

  const reject = async (id: string) => {
    const { data: trade } = await supabase.from("card_trades").select("sender_id").eq("id", id).maybeSingle();
    await supabase.from("card_trades").update({ status: "rejected" }).eq("id", id);
    toast.success("Trade rejected");
    if (trade?.sender_id) {
      notify({ user_id: trade.sender_id, type: "trade_declined", title: "Trade declined", body: "Your trade was declined.", link: "/exchanges" });
    }
  };

  const cancel = async (id: string) => {
    await supabase.from("card_trades").update({ status: "cancelled" }).eq("id", id);
    toast.success("Trade cancelled");
  };

  const [sub, setSub] = useState<"incoming" | "outgoing">("incoming");

  return (
    <div>
      <div className="mb-4 inline-flex rounded-lg border border-border bg-card p-1">
        <button
          onClick={() => setSub("incoming")}
          className={cn(
            "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
            sub === "incoming" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          Incoming ({incoming.length})
        </button>
        <button
          onClick={() => setSub("outgoing")}
          className={cn(
            "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
            sub === "outgoing" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          Outgoing ({outgoing.length})
        </button>
      </div>

      {sub === "incoming" ? (
        incoming.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No incoming offers.</p>
        ) : (
          <div className="space-y-2">
            {incoming.map((t: any) => (
              <TradeCard key={t.id} trade={t} otherUser={t.sender} role="incoming" onAccept={() => accept(t.id)} onReject={() => reject(t.id)} />
            ))}
          </div>
        )
      ) : outgoing.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">You haven't sent any offers.</p>
      ) : (
        <div className="space-y-2">
          {outgoing.map((t: any) => (
            <TradeCard key={t.id} trade={t} otherUser={t.receiver} role="outgoing" onCancel={() => cancel(t.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function TradeCard({
  trade, otherUser, role, onAccept, onReject, onCancel,
}: {
  trade: any; otherUser: any; role: "incoming" | "outgoing";
  onAccept?: () => void; onReject?: () => void; onCancel?: () => void;
}) {
  const senderCount = Array.isArray(trade.sender_cards) ? trade.sender_cards.length : 0;
  const receiverCount = Array.isArray(trade.receiver_cards) ? trade.receiver_cards.length : 0;
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <Link to="/profile/$username" params={{ username: otherUser?.username ?? "" }} className="text-sm font-semibold hover:text-primary">
          @{otherUser?.username ?? "unknown"}
        </Link>
        <span className="text-xs text-muted-foreground">{new Date(trade.created_at).toLocaleDateString()}</span>
      </div>
      <div className="mb-3 flex items-center justify-between gap-2 text-sm">
        <div className="flex-1 text-center">
          <div className="text-xs text-muted-foreground">{role === "incoming" ? "They give" : "You give"}</div>
          <div className="font-bold">{role === "incoming" ? senderCount : senderCount} card{senderCount === 1 ? "" : "s"}</div>
        </div>
        <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1 text-center">
          <div className="text-xs text-muted-foreground">{role === "incoming" ? "You give" : "They give"}</div>
          <div className="font-bold">{receiverCount} card{receiverCount === 1 ? "" : "s"}</div>
        </div>
      </div>
      {trade.message && <p className="mb-3 rounded bg-secondary/50 p-2 text-xs italic">"{trade.message}"</p>}
      <div className="flex justify-end gap-2">
        {role === "incoming" ? (
          <>
            <Button size="sm" variant="outline" onClick={onReject}><X className="mr-1 h-3.5 w-3.5" />Reject</Button>
            <Button size="sm" onClick={onAccept}><Check className="mr-1 h-3.5 w-3.5" />Accept</Button>
          </>
        ) : (
          <Button size="sm" variant="outline" onClick={onCancel}><X className="mr-1 h-3.5 w-3.5" />Cancel</Button>
        )}
      </div>
    </div>
  );
}

function HistoryTab({ userId }: { userId: string }) {
  const { data = [] } = useQuery({
    queryKey: ["trades-history", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("card_trades")
        .select("id, sender_id, receiver_id, sender_cards, receiver_cards, status, created_at, updated_at")
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .neq("status", "pending")
        .order("updated_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });
  if (data.length === 0) return <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No completed trades yet.</p>;
  return (
    <div className="space-y-2">
      {data.map((t: any) => (
        <div key={t.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3 text-sm">
          <div>
            <span className={cn(
              "rounded px-2 py-0.5 text-xs font-bold",
              t.status === "accepted" && "bg-success/20 text-success",
              t.status === "rejected" && "bg-destructive/20 text-destructive",
              t.status === "cancelled" && "bg-muted text-muted-foreground",
            )}>{t.status}</span>
            <span className="ml-2 text-muted-foreground">
              {t.sender_id === userId ? "Sent" : "Received"} • {(t.sender_cards?.length ?? 0)} ↔ {(t.receiver_cards?.length ?? 0)} cards
            </span>
          </div>
          <span className="text-xs text-muted-foreground">{new Date(t.updated_at).toLocaleDateString()}</span>
        </div>
      ))}
    </div>
  );
}

const RANKS_ALL = ["ALL", "X", "S", "A", "B", "C", "D", "E", "F", "G"] as const;

function SmeltTab({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [filter, setFilter] = useState<(typeof RANKS_ALL)[number]>("ALL");
  const [result, setResult] = useState<{ name: string; image: string; rank: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: cards = [] } = useQuery({
    queryKey: ["smelt-cards", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_cards")
        .select("id, quantity, card:cards!inner(id, name, character_name, image_url, rank)")
        .eq("user_id", userId).gt("quantity", 0).eq("is_blocked", false);
      return data ?? [];
    },
  });

  const filtered = filter === "ALL" ? cards : cards.filter((c: any) => c.card.rank === filter);

  // Build rank-set of selected cards to detect mixed ranks
  const selectedCards = cards.filter((c: any) => selected.includes(c.id));
  const selectedRanks = Array.from(new Set(selectedCards.map((c: any) => c.card.rank)));
  const sameRank = selectedRanks.length <= 1;
  const canUpgrade = selected.length === 3 && sameRank;

  const toggle = (id: string) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : (s.length >= 3 ? s : [...s, id]));

  const upgrade = async () => {
    if (!canUpgrade || busy) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("smelt_cards", { _user_card_ids: selected });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const row = (data as any)?.[0] ?? data;
    if (row?.output_card_id) {
      // fetch card details for result modal
      const { data: card } = await supabase.from("cards").select("character_name, image_url, rank").eq("id", row.output_card_id).maybeSingle();
      if (card) setResult({ name: card.character_name, image: card.image_url, rank: card.rank });
    }
    setSelected([]);
    qc.invalidateQueries({ queryKey: ["smelt-cards", userId] });
    qc.invalidateQueries({ queryKey: ["my-cards"] });
    toast.success("Upgrade successful! 🔥");
  };

  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">
        Select <span className="font-bold text-foreground">3 cards of the same rank</span> from your collection to upgrade into 1 random card of the next higher rank.
      </p>

      {/* Selection counter / status */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
        <span className="text-sm font-bold">Selected: {selected.length} / 3</span>
        {selected.length > 0 && !sameRank && (
          <span className="rounded bg-destructive/20 px-2 py-0.5 text-xs font-medium text-destructive">
            Selected cards must all be the same rank
          </span>
        )}
        {selected.length > 0 && (
          <button onClick={() => setSelected([])} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Clear</button>
        )}
      </div>

      {/* Rank filter */}
      <div className="mb-3 flex flex-wrap gap-1">
        {RANKS_ALL.map((r) => (
          <button key={r} onClick={() => setFilter(r)}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-bold transition-colors",
              filter === r ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/80",
            )}>
            {r}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No cards in this rank.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
          {filtered.map((c: any) => {
            const isSelected = selected.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                className={cn(
                  "relative aspect-[2/3] overflow-hidden rounded-md border-2 transition-all",
                  isSelected ? "border-teal-400 ring-2 ring-teal-400/50" : "border-transparent",
                )}
              >
                <img src={c.card.image_url} alt={c.card.character_name} className="h-full w-full object-cover" />
                <div className="absolute right-1 top-1 rounded bg-black/70 px-1 text-[10px] font-bold text-white">×{c.quantity}</div>
                <div className="absolute left-1 top-1 rounded bg-primary px-1 text-[10px] font-bold text-primary-foreground">{c.card.rank}</div>
                {isSelected && (
                  <div className="absolute inset-0 flex items-center justify-center bg-teal-400/30">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-400 text-black"><Check className="h-5 w-5" /></div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <Button
          onClick={upgrade}
          disabled={!canUpgrade || busy}
          className={cn(canUpgrade && "bg-success text-success-foreground hover:bg-success/90")}
        >
          <Flame className="mr-2 h-4 w-4" />
          {busy ? "Upgrading…" : "Upgrade 🔥"}
        </Button>
      </div>

      {/* Result modal */}
      {result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setResult(null)}>
          <div className="rounded-2xl border border-border bg-card p-6 text-center max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-2 text-xl font-bold">🔥 Upgrade complete!</h3>
            <p className="mb-4 text-sm text-muted-foreground">You received a new <span className="font-bold text-foreground">{result.rank}</span> card:</p>
            <img src={result.image} alt={result.name} className="mx-auto mb-3 h-60 w-40 rounded-xl object-cover" />
            <p className="mb-4 font-bold">{result.name}</p>
            <Button onClick={() => setResult(null)} className="w-full">Awesome!</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SplitTab({ userId }: { userId: string }) {
  const { data: profile } = useQuery({
    queryKey: ["split-profile", userId],
    queryFn: async () => {
      const { data } = await supabase.from("user_profiles").select("plan").eq("id", userId).maybeSingle();
      return data;
    },
  });
  const isPro = profile?.plan && profile.plan !== "free";

  if (!isPro) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <Scissors className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <h2 className="mb-1 font-bold">Splitting is a PRO feature</h2>
        <p className="mb-4 text-sm text-muted-foreground">Upgrade to split cards into shards of a higher rank.</p>
        <Button asChild><Link to="/settings">Upgrade plan</Link></Button>
      </div>
    );
  }

  return <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Splitting flow coming soon — select a card to split into 2 shards of the rank above.</p>;
}
