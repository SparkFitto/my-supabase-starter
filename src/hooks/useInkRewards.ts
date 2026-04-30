import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

/**
 * Ink reward sources & amounts.
 * Daily caps are enforced via the daily_ink_log table — sources with a cap
 * check today's total before awarding.
 */
const REWARDS = {
  daily_login: { amount: 10, dailyCap: 10 },
  reading_chapter: { amount: 2, dailyCap: 20 },
  comment: { amount: 1, dailyCap: 10 },
  translation_published: { amount: 25, dailyCap: 250 },
  card_submitted_approved: { amount: 50, dailyCap: null },
} as const;

export type InkSource = keyof typeof REWARDS;

export function useInkRewards() {
  const { user, profile, refreshProfile } = useAuth();

  const award = useCallback(
    async (source: InkSource, opts?: { silent?: boolean }) => {
      if (!user) return { awarded: 0, capped: false };
      const cfg = REWARDS[source];
      if (!cfg) return { awarded: 0, capped: false };

      // Check daily cap
      if (cfg.dailyCap !== null) {
        const today = new Date().toISOString().slice(0, 10);
        const { data: logs } = await supabase
          .from("daily_ink_log")
          .select("amount")
          .eq("user_id", user.id)
          .eq("source", source)
          .gte("created_at", `${today}T00:00:00Z`);
        const usedToday = (logs ?? []).reduce((s, r: any) => s + (r.amount || 0), 0);
        if (usedToday >= cfg.dailyCap) {
          return { awarded: 0, capped: true };
        }
      }

      const { data, error } = await supabase.rpc("award_ink", {
        _amount: cfg.amount,
        _source: source,
      });
      if (error) {
        console.warn("award_ink failed", error);
        return { awarded: 0, capped: false };
      }
      if (!opts?.silent) {
        toast.success(`+${cfg.amount} Ink`, { description: source.replace(/_/g, " ") });
      }
      await refreshProfile();
      return { awarded: cfg.amount, capped: false, balance: data as number };
    },
    [user, refreshProfile]
  );

  const claimDailyLogin = useCallback(async () => {
    if (!user || !profile) return;
    const today = new Date().toISOString().slice(0, 10);
    if (profile.daily_ink_claimed_at === today) return;
    const result = await award("daily_login", { silent: true });
    if (result.awarded > 0) {
      await supabase
        .from("user_profiles")
        .update({ daily_ink_claimed_at: today })
        .eq("id", user.id);
      toast.success(`Daily login bonus: +${result.awarded} Ink 🎉`);
      await refreshProfile();
    }
  }, [user, profile, award, refreshProfile]);

  return { award, claimDailyLogin };
}
