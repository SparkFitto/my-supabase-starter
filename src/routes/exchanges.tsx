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
            <TabsTrigger value="smelt"><Flame className="mr-1.5 h-4 w-4" />Smelt</TabsTrigger>
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
    const { error } = await supabase.rpc("accept_trade", { _trade_id: id });
    if (error) toast.error(error.message);
    else { toast.success("Trade accepted"); qc.invalidateQueries({ queryKey: ["my-cards"] }); }
  };

  const reject = async (id: string) => {
    await supabase.from("card_trades").update({ status: "rejected" }).eq("id", id);
    toast.success("Trade rejected");
  };

  const cancel = async (id: string) => {
    await supabase.from("card_trades").update({ status: "cancelled" }).eq("id", id);
    toast.success("Trade cancelled");
  };

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Incoming ({incoming.length})</h2>
        {incoming.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No incoming offers.</p>
        ) : (
          <div className="space-y-2">
            {incoming.map((t: any) => (
              <TradeCard key={t.id} trade={t} otherUser={t.sender} role="incoming" onAccept={() => accept(t.id)} onReject={() => reject(t.id)} />
            ))}
          </div>
        )}
      </section>
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Outgoing ({outgoing.length})</h2>
        {outgoing.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">You haven't sent any offers.</p>
        ) : (
          <div className="space-y-2">
            {outgoing.map((t: any) => (
              <TradeCard key={t.id} trade={t} otherUser={t.receiver} role="outgoing" onCancel={() => cancel(t.id)} />
            ))}
          </div>
        )}
      </section>
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

function SmeltTab({ userId }: { userId: string }) {
  const [selected, setSelected] = useState<string[]>([]);
  const { data: cards = [] } = useQuery({
    queryKey: ["smelt-cards", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_cards")
        .select("id, quantity, card:cards!inner(id, name, character_name, image_url, rank)")
        .eq("user_id", userId).gt("quantity", 1).eq("is_blocked", false);
      return data ?? [];
    },
  });

  const toggle = (id: string) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  const smelt = async () => {
    if (selected.length === 0) return;
    const { error } = await supabase.from("card_operations").insert({
      user_id: userId, type: "smelt", input_card_ids: selected,
    });
    if (error) toast.error(error.message);
    else { toast.success(`Smelted ${selected.length} card${selected.length === 1 ? "" : "s"} into shards`); setSelected([]); }
  };

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">Convert duplicate cards into rank-matching shards. Only duplicates (quantity &gt; 1) are eligible.</p>
      {cards.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No duplicate cards available to smelt.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
            {cards.map((c: any) => (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                className={cn(
                  "relative aspect-[2/3] overflow-hidden rounded-md border-2 transition-all",
                  selected.includes(c.id) ? "border-primary scale-95 opacity-60" : "border-transparent",
                )}
              >
                <img src={c.card.image_url} alt={c.card.character_name} className="h-full w-full object-cover" />
                <div className="absolute right-1 top-1 rounded bg-black/70 px-1 text-[10px] font-bold text-white">×{c.quantity}</div>
                <div className="absolute left-1 top-1 rounded bg-primary px-1 text-[10px] font-bold text-primary-foreground">{c.card.rank}</div>
              </button>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={smelt} disabled={selected.length === 0}>
              <Flame className="mr-2 h-4 w-4" />Smelt {selected.length} card{selected.length === 1 ? "" : "s"}
            </Button>
          </div>
        </>
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
