import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CardDisplay, type CardData } from "@/components/cards/CardDisplay";
import { CardDetailModal } from "@/components/cards/CardDetailModal";
import { CardSubmitButton } from "@/components/cards/CardSubmitButton";

export function SeriesCardsTab({ seriesId, seriesTitle }: { seriesId: string; seriesTitle: string }) {
  const [openCardId, setOpenCardId] = useState<string | null>(null);

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["series-cards", seriesId],
    queryFn: async () => {
      const { data } = await supabase
        .from("cards")
        .select("id, name, character_name, image_url, rank, is_animated, series:series(slug, title)")
        .eq("series_id", seriesId).eq("is_approved", true)
        .order("rank", { ascending: true });
      return (data ?? []) as CardData[];
    },
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {cards.length} card{cards.length === 1 ? "" : "s"} from this series
        </p>
        <CardSubmitButton seriesId={seriesId} seriesTitle={seriesTitle} />
      </div>
      {isLoading ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-[168px] w-full animate-pulse rounded-xl bg-secondary" />
          ))}
        </div>
      ) : cards.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-8 text-center">
          <div className="mb-2 text-4xl">🎴</div>
          <p className="font-semibold">No cards yet for this series</p>
          <p className="mt-1 text-sm text-muted-foreground">Be the first to submit one!</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 justify-items-center gap-3 sm:grid-cols-4 md:grid-cols-5">
          {cards.map((c) => (
            <CardDisplay key={c.id} card={c} onClick={() => setOpenCardId(c.id)} />
          ))}
        </div>
      )}
      <CardDetailModal cardId={openCardId} onClose={() => setOpenCardId(null)} />
    </div>
  );
}
