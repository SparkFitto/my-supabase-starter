import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";

export const GUILD_LEVEL_THRESHOLDS = [0, 1000, 5000, 15000, 40000, 100000, 250000, 500000, 900000, 1500000];

export function levelProgress(xp: number, level: number) {
  const cur = GUILD_LEVEL_THRESHOLDS[level - 1] ?? 0;
  const next = GUILD_LEVEL_THRESHOLDS[level] ?? GUILD_LEVEL_THRESHOLDS[GUILD_LEVEL_THRESHOLDS.length - 1];
  if (level >= 10) return { cur: xp, next, pct: 100, isMax: true };
  const pct = Math.min(100, Math.max(0, ((xp - cur) / (next - cur)) * 100));
  return { cur: xp, next, pct, isMax: false };
}

export function timeRemaining(ends_at: string) {
  const ms = new Date(ends_at).getTime() - Date.now();
  if (ms <= 0) return "Ended";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h remaining`;
  if (h > 0) return `${h}h ${m}m remaining`;
  return `${m}m remaining`;
}

/** Add a user to a guild, grant guild card, increment count, notify nobody by default. */
export async function addMember(opts: {
  guild_id: string;
  user_id: string;
  role?: "leader" | "officer" | "member";
}) {
  const { guild_id, user_id, role = "member" } = opts;
  await supabase.from("guild_members").insert({ guild_id, user_id, role });
  await supabase.from("user_profiles").update({ guild_id } as never).eq("id", user_id);
  // increment member count via direct update (count members)
  const { count } = await supabase
    .from("guild_members")
    .select("id", { count: "exact", head: true })
    .eq("guild_id", guild_id);
  await supabase.from("guilds").update({ member_count: count ?? 1 } as never).eq("id", guild_id);

  // grant guild card if set
  const { data: g } = await supabase.from("guilds").select("guild_card_id").eq("id", guild_id).maybeSingle();
  const cardId = (g as any)?.guild_card_id;
  if (cardId) {
    await grantCardToUser(user_id, cardId);
  }
}

/** Remove a member, take back guild card, decrement count. */
export async function removeMember(opts: { guild_id: string; user_id: string }) {
  const { guild_id, user_id } = opts;
  // Take back guild card
  const { data: g } = await supabase.from("guilds").select("guild_card_id").eq("id", guild_id).maybeSingle();
  const cardId = (g as any)?.guild_card_id;
  if (cardId) {
    await removeCardFromUser(user_id, cardId);
  }
  await supabase.from("guild_members").delete().eq("guild_id", guild_id).eq("user_id", user_id);
  // clear profile guild_id
  await supabase.from("user_profiles").update({ guild_id: null } as never).eq("id", user_id);
  const { count } = await supabase
    .from("guild_members")
    .select("id", { count: "exact", head: true })
    .eq("guild_id", guild_id);
  await supabase.from("guilds").update({ member_count: count ?? 0 } as never).eq("id", guild_id);
}

export async function grantCardToUser(user_id: string, card_id: string) {
  const { data: existing } = await supabase
    .from("user_cards")
    .select("id, quantity")
    .eq("user_id", user_id)
    .eq("card_id", card_id)
    .maybeSingle();
  if (existing) {
    await supabase
      .from("user_cards")
      .update({ quantity: (existing as any).quantity + 1 } as never)
      .eq("id", (existing as any).id);
  } else {
    await supabase.from("user_cards").insert({ user_id, card_id, quantity: 1 } as never);
  }
}

export async function removeCardFromUser(user_id: string, card_id: string) {
  const { data: existing } = await supabase
    .from("user_cards")
    .select("id, quantity")
    .eq("user_id", user_id)
    .eq("card_id", card_id)
    .maybeSingle();
  if (!existing) return;
  const next = (existing as any).quantity - 1;
  if (next <= 0) {
    await supabase.from("user_cards").delete().eq("id", (existing as any).id);
  } else {
    await supabase.from("user_cards").update({ quantity: next } as never).eq("id", (existing as any).id);
  }
}

/** Notify all members of a guild. */
export async function notifyGuild(guild_id: string, n: { type: any; title: string; body?: string; link?: string }) {
  const { data: members } = await supabase.from("guild_members").select("user_id").eq("guild_id", guild_id);
  if (!members) return;
  await Promise.all(
    (members as any[]).map((m) =>
      notify({ user_id: m.user_id, ...n }),
    ),
  );
}
