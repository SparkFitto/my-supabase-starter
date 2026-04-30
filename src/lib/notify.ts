import { supabase } from "@/integrations/supabase/client";

export type NotificationType =
  | "card_approved"
  | "card_rejected"
  | "trade_received"
  | "trade_accepted"
  | "trade_declined"
  | "card_drop"
  | "lot_sold"
  | "request_filled"
  | "deck_liked"
  | "comment_reply"
  | "friend_request"
  | "friend_accepted";

export async function notify(params: {
  user_id: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
}) {
  const { error } = await supabase.from("notifications").insert(params);
  if (error) console.warn("notify failed", error);
}
