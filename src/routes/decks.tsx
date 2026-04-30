import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, Plus, Eye, Trash2, Save, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/decks")({
  head: () => ({ meta: [{ title: "Decks — RAWL" }] }),
  component: DecksPage,
});

function DecksPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState("public");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Decks</h1>
          {user && (
            <Button size="sm" onClick={() => { setCreating(true); setEditingId(null); }}>
              <Plus className="mr-1.5 h-4 w-4" />Create deck
            </Button>
          )}
        </div>

        {(creating || editingId) && user && (
          <DeckEditor
            userId={user.id}
            deckId={editingId}
            onClose={() => { setCreating(false); setEditingId(null); }}
          />
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="public">Public decks</TabsTrigger>
            {user && <TabsTrigger value="mine">My decks</TabsTrigger>}
          </TabsList>
          <TabsContent value="public" className="mt-6">
            <PublicDecks viewerId={user?.id ?? null} />
          </TabsContent>
          {user && (
            <TabsContent value="mine" className="mt-6">
              <MyDecks userId={user.id} onEdit={(id) => { setEditingId(id); setCreating(false); }} />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}

function DeckCard({ deck, viewerId, onEdit }: { deck: any; viewerId: string | null; onEdit?: () => void }) {
  const qc = useQueryClient();
  const isOwn = viewerId === deck.user_id;

  const { data: liked } = useQuery({
    queryKey: ["deck-liked", deck.id, viewerId],
    enabled: !!viewerId,
    queryFn: async () => {
      const { data } = await supabase.from("card_deck_likes").select("user_id")
        .eq("deck_id", deck.id).eq("user_id", viewerId!).maybeSingle();
      return !!data;
    },
  });

  const toggleLike = async () => {
    if (!viewerId) { toast.error("Sign in to like"); return; }
    if (liked) {
      await supabase.from("card_deck_likes").delete().eq("deck_id", deck.id).eq("user_id", viewerId);
      await supabase.from("card_decks").update({ likes: Math.max(0, (deck.likes ?? 1) - 1) }).eq("id", deck.id);
    } else {
      await supabase.from("card_deck_likes").insert({ deck_id: deck.id, user_id: viewerId });
      await supabase.from("card_decks").update({ likes: (deck.likes ?? 0) + 1 }).eq("id", deck.id);
    }
    qc.invalidateQueries({ queryKey: ["deck-liked", deck.id] });
    qc.invalidateQueries({ queryKey: ["public-decks"] });
    qc.invalidateQueries({ queryKey: ["my-decks"] });
  };

  const remove = async () => {
    if (!confirm("Delete this deck?")) return;
    await supabase.from("card_decks").delete().eq("id", deck.id);
    qc.invalidateQueries({ queryKey: ["my-decks"] });
    qc.invalidateQueries({ queryKey: ["public-decks"] });
  };

  const cardIds: string[] = deck.card_ids ?? [];

  const { data: previewCards = [] } = useQuery({
    queryKey: ["deck-preview", deck.id, cardIds.slice(0, 6).join(",")],
    enabled: cardIds.length > 0,
    queryFn: async () => {
      const ids = cardIds.slice(0, 6);
      const { data } = await supabase.from("cards").select("id, image_url, character_name, rank").in("id", ids);
      return data ?? [];
    },
  });

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-bold">{deck.name}</h3>
          {deck.profile?.username && (
            <Link to="/profile/$username" params={{ username: deck.profile.username }} className="text-xs text-muted-foreground hover:text-primary">
              @{deck.profile.username}
            </Link>
          )}
        </div>
        {deck.is_trade_deck && <span className="rounded bg-teal-500 px-2 py-0.5 text-[10px] font-bold text-white">TRADE</span>}
      </div>
      {deck.description && <p className="mb-3 line-clamp-2 text-xs text-muted-foreground">{deck.description}</p>}
      {previewCards.length > 0 ? (
        <div className="mb-3 flex gap-1 overflow-hidden">
          {previewCards.map((c: any) => (
            <img key={c.id} src={c.image_url} alt={c.character_name} className="h-16 w-11 rounded object-cover" />
          ))}
        </div>
      ) : (
        <p className="mb-3 text-xs text-muted-foreground italic">Empty deck</p>
      )}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span><Layers className="mr-1 inline h-3 w-3" />{cardIds.length} cards</span>
        <div className="flex items-center gap-3">
          <span><Eye className="mr-1 inline h-3 w-3" />{deck.views ?? 0}</span>
          <button onClick={toggleLike} className={cn("flex items-center gap-1 transition-colors", liked && "text-primary")}>
            <Heart className={cn("h-3 w-3", liked && "fill-current")} />{deck.likes ?? 0}
          </button>
        </div>
      </div>
      {isOwn && (
        <div className="mt-3 flex justify-end gap-2 border-t border-border pt-3">
          <Button size="sm" variant="outline" onClick={onEdit}>Edit</Button>
          <Button size="sm" variant="outline" onClick={remove}><Trash2 className="h-3 w-3" /></Button>
        </div>
      )}
    </div>
  );
}

function PublicDecks({ viewerId }: { viewerId: string | null }) {
  const { data = [] } = useQuery({
    queryKey: ["public-decks"],
    queryFn: async () => {
      const { data } = await supabase
        .from("card_decks")
        .select("id, user_id, name, description, card_ids, is_public, is_trade_deck, likes, views, created_at, profile:user_profiles!inner(username, avatar_url)")
        .eq("is_public", true)
        .order("likes", { ascending: false })
        .limit(30);
      return data ?? [];
    },
  });
  if (data.length === 0) return <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No public decks yet.</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((d: any) => <DeckCard key={d.id} deck={d} viewerId={viewerId} />)}
    </div>
  );
}

function MyDecks({ userId, onEdit }: { userId: string; onEdit: (id: string) => void }) {
  const { data = [] } = useQuery({
    queryKey: ["my-decks", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("card_decks")
        .select("id, user_id, name, description, card_ids, is_public, is_trade_deck, likes, views, created_at, profile:user_profiles!inner(username, avatar_url)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  if (data.length === 0) return <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">You haven't created any decks yet.</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((d: any) => <DeckCard key={d.id} deck={d} viewerId={userId} onEdit={() => onEdit(d.id)} />)}
    </div>
  );
}

function DeckEditor({ userId, deckId, onClose }: { userId: string; deckId: string | null; onClose: () => void }) {
  const qc = useQueryClient();

  const { data: existing } = useQuery({
    queryKey: ["deck-edit", deckId],
    enabled: !!deckId,
    queryFn: async () => {
      const { data } = await supabase.from("card_decks").select("*").eq("id", deckId!).maybeSingle();
      return data;
    },
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [isTradeDeck, setIsTradeDeck] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  if (existing && !hydrated) {
    setName(existing.name);
    setDescription(existing.description ?? "");
    setIsPublic(existing.is_public);
    setIsTradeDeck(existing.is_trade_deck);
    setSelected(existing.card_ids ?? []);
    setHydrated(true);
  }

  const { data: myCards = [] } = useQuery({
    queryKey: ["my-cards-for-deck", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_cards")
        .select("card_id, quantity, card:cards!inner(id, character_name, image_url, rank)")
        .eq("user_id", userId).gt("quantity", 0);
      return data ?? [];
    },
  });

  const toggle = (cardId: string) => {
    setSelected((s) => s.includes(cardId) ? s.filter((x) => x !== cardId) : [...s, cardId]);
  };

  const save = async () => {
    if (!name.trim()) { toast.error("Name required"); return; }
    const payload = {
      user_id: userId, name: name.trim(), description: description.trim() || null,
      card_ids: selected, is_public: isPublic, is_trade_deck: isTradeDeck,
      updated_at: new Date().toISOString(),
    };
    if (deckId) {
      const { error } = await supabase.from("card_decks").update(payload).eq("id", deckId);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("card_decks").insert(payload);
      if (error) { toast.error(error.message); return; }
    }
    toast.success(deckId ? "Deck updated" : "Deck created");
    qc.invalidateQueries({ queryKey: ["my-decks"] });
    qc.invalidateQueries({ queryKey: ["public-decks"] });
    onClose();
  };

  return (
    <div className="mb-6 rounded-xl border border-primary/30 bg-card p-5">
      <h2 className="mb-3 text-lg font-bold">{deckId ? "Edit deck" : "Create deck"}</h2>
      <div className="space-y-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Deck name" className="w-full rounded border border-border bg-background px-3 py-2 text-sm" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" rows={2} className="w-full rounded border border-border bg-background px-3 py-2 text-sm" />
        <div className="flex flex-wrap gap-3 text-sm">
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />Public</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={isTradeDeck} onChange={(e) => setIsTradeDeck(e.target.checked)} />Trade deck</label>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Cards in deck ({selected.length})
          </p>
          <div className="grid max-h-72 grid-cols-4 gap-2 overflow-y-auto rounded border border-border bg-background p-2 sm:grid-cols-6 md:grid-cols-8">
            {myCards.map((c: any) => (
              <button key={c.card_id} onClick={() => toggle(c.card_id)} className={cn(
                "relative aspect-[2/3] overflow-hidden rounded border-2 transition-all",
                selected.includes(c.card_id) ? "border-primary scale-95" : "border-transparent opacity-60 hover:opacity-100",
              )}>
                <img src={c.card.image_url} alt={c.card.character_name} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={save}><Save className="mr-1.5 h-4 w-4" />Save deck</Button>
        </div>
      </div>
    </div>
  );
}
