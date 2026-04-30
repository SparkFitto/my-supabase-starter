import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/**
 * Mounts on the reader page. When the user finishes (or is reading) a chapter,
 * has a low chance to drop a random card from the series catalog.
 * Logs the drop to reading_card_drops and grants a user_card.
 */
export function CardDropTrigger({ seriesId, translationId }: { seriesId?: string | null; translationId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user || !seriesId) return;
    // 8% chance per reader-mount; only one attempt per (user, translation) per session
    const key = `card-drop:${user.id}:${translationId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");

    const timer = setTimeout(async () => {
      if (Math.random() > 0.08) return;

      // Pick a random card from this series (any rank)
      const { data: cards } = await supabase
        .from("cards")
        .select("id, character_name, rank, image_url")
        .eq("series_id", seriesId)
        .eq("is_approved", true)
        .limit(50);

      if (!cards || cards.length === 0) return;
      const card = cards[Math.floor(Math.random() * cards.length)];

      // Log + grant
      await supabase.from("reading_card_drops").insert({
        user_id: user.id, card_id: card.id, series_id: seriesId,
      });
      await supabase.from("user_cards").upsert(
        { user_id: user.id, card_id: card.id, quantity: 1 },
        { onConflict: "user_id,card_id", ignoreDuplicates: false },
      );
      // Increment quantity if exists
      const { data: existing } = await supabase
        .from("user_cards").select("id, quantity")
        .eq("user_id", user.id).eq("card_id", card.id).maybeSingle();
      if (existing && existing.quantity > 1) {
        // upsert above set to 1 incorrectly if pre-existed; nudge to +1
        await supabase.from("user_cards").update({ quantity: existing.quantity + 1 }).eq("id", existing.id);
      }

      qc.invalidateQueries({ queryKey: ["my-cards"] });

      toast.success(`🎴 Card dropped: ${card.character_name} [${card.rank}]`, {
        description: "Added to your collection!",
        duration: 6000,
      });
    }, 4000);

    return () => clearTimeout(timer);
  }, [user?.id, seriesId, translationId, qc]);

  return null;
}
