import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, Sparkles, Loader2 } from "lucide-react";
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

const SINGLE_COST = 55;
const TEN_COST = 500;

type Mode = "single" | "ten";

interface PendingOpening {
  opening_id: string;
  cards: string[]; // 3 candidate card ids
  chosen?: string | null;
}

function PacksPage() {
  const { user, profile, loading } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode>("single");
  const [openings, setOpenings] = useState<PendingOpening[]>([]); // 1 or 10 columns

  useEffect(() => {
    if (!loading && !user) nav({ to: "/signin", search: { redirect: "/packs" } as any });
  }, [loading, user, nav]);

  // ── Persistence: restore unfinished openings on mount ────────────────────
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("pack_openings")
        .select("id, cards_shown, card_chosen, opened_at")
        .eq("user_id", user.id)
        .is("card_chosen", null)
        .order("opened_at", { ascending: true })
        .limit(20);
      if (cancelled || !data || data.length === 0) return;
      // Group into one batch (treat any open openings as a single pending session)
      const pending: PendingOpening[] = data.map((r: any) => ({
        opening_id: r.id, cards: r.cards_shown ?? [], chosen: null,
      }));
      setOpenings(pending);
      setMode(pending.length > 1 ? "ten" : "single");
      toast.message(`You have ${pending.length} unfinished pack${pending.length === 1 ? "" : "s"}. Pick your card${pending.length === 1 ? "" : "s"} below!`);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  // ── Fetch the candidate card data ────────────────────────────────────────
  const allCardIds = useMemo(
    () => Array.from(new Set(openings.flatMap((o) => o.cards))),
    [openings],
  );
  const { data: cardMap = {} } = useQuery({
    queryKey: ["pack-cards-batch", allCardIds],
    enabled: allCardIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("cards")
        .select("id, name, character_name, image_url, rank, is_animated, series:series(slug, title)")
        .in("id", allCardIds);
      const map: Record<string, CardData> = {};
      (data ?? []).forEach((c: any) => { map[c.id] = c as CardData; });
      return map;
    },
  });

  const ink = profile?.ink_balance ?? 0;
  const cost = mode === "ten" ? TEN_COST : SINGLE_COST;
  const canAfford = ink >= cost;

  const openSingle = async () => {
    if (busy) return;
    if (!canAfford) return toast.error("Not enough Ink");
    setBusy(true);
    const { data, error } = await supabase.rpc("open_pack");
    setBusy(false);
    if (error) return toast.error(error.message);
    const row = (data as any)?.[0] ?? data;
    if (!row?.opening_id) return toast.error("Pack failed");
    setMode("single");
    setOpenings([{ opening_id: row.opening_id, cards: row.card_ids, chosen: null }]);
    qc.invalidateQueries({ queryKey: ["auth-profile"] });
  };

  const openTen = async () => {
    if (busy) return;
    if (ink < TEN_COST) return toast.error(`Not enough Ink (need ${TEN_COST})`);
    setBusy(true);
    const { data, error } = await supabase.rpc("open_pack_10");
    setBusy(false);
    if (error) return toast.error(error.message);
    const row = (data as any)?.[0] ?? data;
    if (!row?.columns) return toast.error("Pack failed");
    const cols = (row.columns as any[]).map((c) => ({
      opening_id: c.opening_id, cards: c.cards as string[], chosen: null,
    }));
    setMode("ten");
    setOpenings(cols);
    qc.invalidateQueries({ queryKey: ["auth-profile"] });
  };

  const pickCard = async (openingIdx: number, cardId: string) => {
    const op = openings[openingIdx];
    if (!op || op.chosen) return;
    const { error } = await supabase.rpc("pack_select_card", { _opening_id: op.opening_id, _card_id: cardId });
    if (error) return toast.error(error.message);
    setOpenings((prev) => prev.map((o, i) => (i === openingIdx ? { ...o, chosen: cardId } : o)));
    qc.invalidateQueries({ queryKey: ["my-cards"] });
    qc.invalidateQueries({ queryKey: ["auth-profile"] });
    // Award guild XP for pack opening (best-effort, fire-and-forget)
    const gid = (profile as any)?.guild_id;
    if (gid && user) {
      supabase.rpc("award_guild_xp" as any, {
        _guild_id: gid, _user_id: user.id, _amount: 2,
        _source: "pack_opened", _description: "Opened a card pack",
      } as any).then(() => {/* ignore */}, () => {/* ignore */});
    }
  };

  const allChosen = openings.length > 0 && openings.every((o) => !!o.chosen);
  const reset = () => setOpenings([]);

  // Auto-reset 2s after the user has finished picking — return to pre-opening state
  useEffect(() => {
    if (!allChosen) return;
    const t = setTimeout(() => setOpenings([]), 2000);
    return () => clearTimeout(t);
  }, [allChosen]);

  if (loading || !user) {
    return <div className="min-h-screen bg-background"><Header /><div className="p-8 text-center text-muted-foreground">Loading…</div></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Card Packs</h1>
          <div className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm font-bold">
            <span>🖊️</span><span>{ink}</span>
            <span className="text-xs text-muted-foreground">Ink</span>
          </div>
        </div>

        {/* IDLE — pack picker */}
        {openings.length === 0 && (
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="rounded-2xl border border-border bg-card p-3 sm:p-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-9 sm:h-32 sm:w-24 items-center justify-center rounded-lg sm:rounded-xl border-2 border-primary bg-gradient-to-br from-primary/30 to-purple-500/30 shadow-lg">
                <Package className="h-5 w-5 sm:h-12 sm:w-12 text-primary" />
              </div>
              <h2 className="mb-1 text-sm sm:text-xl font-bold">Standard Pack</h2>
              <p className="mb-3 sm:mb-4 text-[11px] sm:text-sm text-muted-foreground">3 cards. Choose 1.</p>
              <Button size="sm" className="w-full sm:size-lg sm:w-auto" onClick={openSingle} disabled={!canAfford || busy}>
                {busy && mode === "single" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4 sm:h-5 sm:w-5" />}
                <span className="text-xs sm:text-sm">{SINGLE_COST} Ink</span>
              </Button>
            </div>

            <div className="rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-card to-primary/5 p-3 sm:p-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 sm:h-32 sm:w-32 items-center justify-center rounded-lg sm:rounded-xl border-2 border-primary bg-gradient-to-br from-primary/40 to-purple-500/40 shadow-lg">
                <div className="flex flex-col items-center">
                  <Package className="h-4 w-4 sm:h-10 sm:w-10 text-primary" />
                  <span className="mt-0.5 text-[9px] sm:text-xs font-bold text-primary">×10</span>
                </div>
              </div>
              <h2 className="mb-1 text-sm sm:text-xl font-bold">Mega Pack <span className="text-primary">×10</span></h2>
              <p className="mb-3 sm:mb-4 text-[11px] sm:text-sm text-muted-foreground">10×3 cards. Best value.</p>
              <Button size="sm" className="w-full sm:size-lg sm:w-auto bg-gradient-to-r from-primary to-purple-500" onClick={openTen} disabled={ink < TEN_COST || busy}>
                {busy && mode === "ten" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4 sm:h-5 sm:w-5" />}
                <span className="text-xs sm:text-sm">{TEN_COST} Ink</span>
              </Button>
              {ink < TEN_COST && <p className="mt-1.5 text-[10px] sm:text-xs text-destructive">Need {TEN_COST - ink} more</p>}
            </div>

            <div className="col-span-2 rounded-xl border border-border bg-card/50 p-3 text-center text-[10px] sm:text-xs text-muted-foreground">
              <strong className="text-foreground">Pity:</strong> S at 50 · X at 150
              {profile && (
                <span className="ml-1 sm:ml-2">· <span className="text-foreground font-bold">{profile.s_pity_counter ?? 0}/50</span> S · <span className="text-foreground font-bold">{profile.x_pity_counter ?? 0}/150</span> X</span>
              )}
            </div>
          </div>
        )}

        {/* OPEN — single column */}
        {openings.length === 1 && (
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="mb-1 text-center text-xl font-bold">
              {openings[0].chosen ? "🎉 Card added!" : "Choose 1 card to keep"}
            </h2>
            <p className="mb-6 text-center text-sm text-muted-foreground">
              {openings[0].chosen ? "The unchosen cards have been discarded." : "The other 2 will be lost forever."}
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              {openings[0].cards.map((cid) => {
                const card = cardMap[cid];
                if (!card) return <div key={cid} className="h-[224px] w-[160px] animate-pulse rounded-xl bg-secondary" />;
                const isChosen = openings[0].chosen === cid;
                const isFaded = !!openings[0].chosen && !isChosen;
                return (
                  <div key={cid} className={cn("transition-all duration-500", isFaded && "scale-90 opacity-30 grayscale", isChosen && "scale-110")}>
                    <CardDisplay card={card} size="lg" onClick={!openings[0].chosen ? () => pickCard(0, cid) : undefined} />
                  </div>
                );
              })}
            </div>
            {openings[0].chosen && (
              <div className="mt-8 flex justify-center gap-3">
                <Button onClick={reset}><Sparkles className="mr-2 h-4 w-4" />Open Another</Button>
                <Button variant="outline" asChild><Link to="/my-cards">View Collection</Link></Button>
              </div>
            )}
          </div>
        )}

        {/* OPEN — 10x columns */}
        {openings.length > 1 && (
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold sm:text-xl">
                Mega Pack — Choose 1 per column
              </h2>
              <span className="text-sm font-bold text-primary">
                {openings.filter((o) => o.chosen).length} / {openings.length}
              </span>
            </div>
            <p className="mb-4 text-xs text-muted-foreground">
              Tap a card in each column to keep it. The other 2 in that column are discarded. Your progress is saved if you leave the page.
            </p>

            <div className="overflow-x-auto pb-3 [scrollbar-width:thin]">
              <div className="flex gap-3 sm:gap-4">
                {openings.map((op, idx) => (
                  <div key={op.opening_id} className="flex shrink-0 flex-col gap-2">
                    <div className={cn(
                      "rounded-md px-2 py-1 text-center text-[11px] font-bold",
                      op.chosen ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
                    )}>
                      Pack {idx + 1}
                    </div>
                    <div className="flex flex-row gap-2">
                      {op.cards.map((cid) => {
                        const card = cardMap[cid];
                        if (!card) return <div key={cid} className="h-[126px] w-[90px] animate-pulse rounded-xl bg-secondary" />;
                        const isChosen = op.chosen === cid;
                        const isFaded = !!op.chosen && !isChosen;
                        return (
                          <div key={cid} className={cn(
                            "transition-all duration-300",
                            isFaded && "opacity-25 grayscale",
                            isChosen && "ring-4 ring-primary rounded-xl",
                          )}>
                            <CardDisplay card={card} size="sm" onClick={!op.chosen ? () => pickCard(idx, cid) : undefined} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {allChosen && (
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button onClick={reset}><Sparkles className="mr-2 h-4 w-4" />Open Another</Button>
                <Button variant="outline" asChild><Link to="/my-cards">View Collection</Link></Button>
              </div>
            )}
          </div>
        )}

        {/* LIVE TICKER */}
        <RecentPicksTicker />
      </main>
    </div>
  );
}

// ─── Live recent picks (global) ──────────────────────────────────────────
interface RecentPick {
  opening_id: string;
  card_id: string;
  character_name: string;
  rank: string;
  image_url: string;
  username: string | null;
  avatar_url: string | null;
  opened_at: string;
}

function RecentPicksTicker() {
  const qc = useQueryClient();
  const { data: picks = [] } = useQuery<RecentPick[]>({
    queryKey: ["recent-pack-picks"],
    queryFn: async () => {
      const { data } = await supabase.rpc("recent_pack_picks", { _limit: 5 });
      return (data as RecentPick[]) ?? [];
    },
    refetchInterval: 15000,
  });

  // Realtime subscription — listen for any pack_openings UPDATE that sets card_chosen,
  // and just invalidate the query (throttled by react-query). Avoids glitching on bursts.
  useEffect(() => {
    let pending = false;
    const channel = supabase
      .channel("pack-picks-feed")
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "pack_openings" },
        (payload: any) => {
          if (!payload.new?.card_chosen) return;
          if (pending) return;
          pending = true;
          setTimeout(() => {
            pending = false;
            qc.invalidateQueries({ queryKey: ["recent-pack-picks"] });
          }, 1500); // 1.5s throttle
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  if (picks.length === 0) return null;

  return (
    <section className="mt-10">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
        </span>
        Live picks
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {picks.map((p) => (
          <div
            key={p.opening_id}
            className="flex shrink-0 animate-in slide-in-from-top-2 fade-in flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-2 duration-500"
            style={{ width: 110 }}
          >
            <div className="relative h-[126px] w-[90px] overflow-hidden rounded-lg">
              <img src={p.image_url} alt={p.character_name} className="h-full w-full object-cover" />
              <span className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {p.rank}
              </span>
            </div>
            <div className="w-full truncate text-center text-[11px] font-semibold">{p.character_name}</div>
            <Link
              to="/profile/$username"
              params={{ username: p.username ?? "" }}
              className="w-full truncate text-center text-[10px] text-muted-foreground hover:text-foreground"
            >
              @{p.username ?? "anon"}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
