import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CardDisplay, type CardData } from "@/components/cards/CardDisplay";
import { CardDetailModal } from "@/components/cards/CardDetailModal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SLOTS = [0, 1, 2, 3, 4, 5];

export function ShowcaseSection({ userId, isOwn }: { userId: string; isOwn: boolean }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<number, string | null>>({});

  const { data: showcase = [] } = useQuery({
    queryKey: ["showcase", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("showcase_cards")
        .select("position, user_card_id, user_card:user_cards(id, quantity, frame_level, card:cards!inner(id, name, character_name, image_url, rank, is_animated, series:series(slug, title)))")
        .eq("user_id", userId)
        .order("position");
      return data ?? [];
    },
  });

  const { data: myCards = [] } = useQuery({
    queryKey: ["showcase-my-cards", userId],
    enabled: isOwn && editing,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_cards")
        .select("id, quantity, frame_level, card:cards!inner(id, name, character_name, image_url, rank, is_animated, series:series(slug, title))")
        .eq("user_id", userId).gt("quantity", 0);
      return data ?? [];
    },
  });

  const startEdit = () => {
    const initial: Record<number, string | null> = {};
    SLOTS.forEach((p) => {
      const found = showcase.find((s: any) => s.position === p);
      initial[p] = found?.user_card_id ?? null;
    });
    setDraft(initial);
    setEditing(true);
  };

  const setSlot = (position: number, userCardId: string | null) => {
    setDraft((d) => ({ ...d, [position]: userCardId }));
  };

  const save = async () => {
    await supabase.from("showcase_cards").delete().eq("user_id", userId);
    const rows = SLOTS
      .filter((p) => draft[p])
      .map((p) => ({ user_id: userId, position: p, user_card_id: draft[p]! }));
    if (rows.length > 0) await supabase.from("showcase_cards").insert(rows);
    qc.invalidateQueries({ queryKey: ["showcase", userId] });
    setEditing(false);
  };

  const slots = SLOTS.map((p) => {
    const found = showcase.find((s: any) => s.position === p);
    return found?.user_card as { id: string; quantity: number; frame_level: number; card: CardData } | undefined;
  });

  if (!isOwn && showcase.length === 0) return null;

  return (
    <section className="rounded-xl border border-border bg-card/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Card Showcase</h3>
        {isOwn && !editing && (
          <button onClick={startEdit} className="text-xs text-primary hover:underline flex items-center gap-1">
            <Pencil className="h-3 w-3" />Edit
          </button>
        )}
        {editing && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}><X className="h-3 w-3" /></Button>
            <Button size="sm" onClick={save}><Save className="mr-1 h-3 w-3" />Save</Button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {SLOTS.map((p) => {
              const cardId = draft[p];
              const uc = myCards.find((m: any) => m.id === cardId);
              return (
                <div key={p} className={cn(
                  "relative aspect-[2/3] rounded-lg border-2 border-dashed flex items-center justify-center",
                  cardId ? "border-primary" : "border-border",
                )}>
                  {uc ? (
                    <>
                      <img src={uc.card.image_url} alt="" className="h-full w-full rounded-md object-cover" />
                      <button onClick={() => setSlot(p, null)} className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-destructive text-xs text-white">×</button>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">Slot {p + 1}</span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pick from your collection:</p>
          <div className="grid max-h-48 grid-cols-4 gap-2 overflow-y-auto rounded border border-border p-2 sm:grid-cols-6 md:grid-cols-8">
            {myCards.map((c: any) => {
              const inShowcase = Object.values(draft).includes(c.id);
              return (
                <button
                  key={c.id}
                  disabled={inShowcase}
                  onClick={() => {
                    const emptySlot = SLOTS.find((p) => !draft[p]);
                    if (emptySlot !== undefined) setSlot(emptySlot, c.id);
                  }}
                  className={cn(
                    "relative aspect-[2/3] overflow-hidden rounded border-2 transition",
                    inShowcase ? "opacity-30 border-transparent" : "border-transparent hover:border-primary",
                  )}
                >
                  <img src={c.card.image_url} alt={c.card.character_name} className="h-full w-full object-cover" />
                </button>
              );
            })}
            {myCards.length === 0 && <p className="col-span-full p-2 text-xs text-muted-foreground">No cards yet.</p>}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {slots.map((uc, i) => (
            <div key={i} className="aspect-[2/3]">
              {uc ? (
                <CardDisplay
                  card={uc.card}
                  userCard={{ id: uc.id, quantity: uc.quantity, frame_level: uc.frame_level }}
                  size="sm"
                  className="w-full"
                  onClick={() => setOpenCardId(uc.card.id)}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
                  Empty
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <CardDetailModal cardId={openCardId} onClose={() => setOpenCardId(null)} />
    </section>
  );
}
