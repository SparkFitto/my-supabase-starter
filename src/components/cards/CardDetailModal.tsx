import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Flag, Users, Heart, ArrowLeftRight, Gift, X, Send, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { CardDisplay, type CardData } from "./CardDisplay";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  cardId: string | null;
  onClose: () => void;
}

export function CardDetailModal({ cardId, onClose }: Props) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("lots");
  const [commentText, setCommentText] = useState("");

  const { data: card } = useQuery({
    queryKey: ["card-detail", cardId],
    enabled: !!cardId,
    queryFn: async () => {
      const { data } = await supabase
        .from("cards")
        .select("id, name, character_name, image_url, rank, is_animated, submitted_by, series:series(slug, title)")
        .eq("id", cardId!)
        .maybeSingle();
      return data as (CardData & { submitted_by: string | null }) | null;
    },
  });

  const { data: submitter } = useQuery({
    queryKey: ["card-submitter", card?.submitted_by],
    enabled: !!card?.submitted_by,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("username")
        .eq("id", card!.submitted_by!)
        .maybeSingle();
      return data;
    },
  });

  const { data: ownerCount = 0 } = useQuery({
    queryKey: ["card-owner-count", cardId],
    enabled: !!cardId,
    queryFn: async () => {
      const { count } = await supabase
        .from("user_cards")
        .select("*", { count: "exact", head: true })
        .eq("card_id", cardId!)
        .gt("quantity", 0);
      return count ?? 0;
    },
  });

  const { data: ownersList = [] } = useQuery({
    queryKey: ["card-owners-list", cardId],
    enabled: !!cardId,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_cards")
        .select("user_id, profile:user_profiles!inner(id, username, avatar_url)")
        .eq("card_id", cardId!)
        .gt("quantity", 0)
        .limit(10);
      return data ?? [];
    },
  });

  const { data: comments = [], refetch: refetchComments } = useQuery({
    queryKey: ["card-comments", cardId],
    enabled: !!cardId,
    queryFn: async () => {
      const { data } = await supabase
        .from("card_comments")
        .select("id, content, created_at, user_id, profile:user_profiles!inner(username, avatar_url)")
        .eq("card_id", cardId!)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const { data: userOwnsCard = false } = useQuery({
    queryKey: ["user-owns-card", user?.id, cardId],
    enabled: !!user && !!cardId,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_cards")
        .select("id")
        .eq("user_id", user!.id)
        .eq("card_id", cardId!)
        .gt("quantity", 0)
        .maybeSingle();
      return !!data;
    },
  });

  const { data: isWanted = false, refetch: refetchWanted } = useQuery({
    queryKey: ["card-wanted", user?.id, cardId],
    enabled: !!user && !!cardId,
    queryFn: async () => {
      const { data } = await supabase
        .from("card_wishlist")
        .select("user_id")
        .eq("user_id", user!.id)
        .eq("card_id", cardId!)
        .eq("type", "want")
        .maybeSingle();
      return !!data;
    },
  });

  const toggleWishlist = async () => {
    if (!user || !cardId) {
      toast.error("Sign in to use wishlist");
      return;
    }
    if (isWanted) {
      await supabase.from("card_wishlist").delete().eq("user_id", user.id).eq("card_id", cardId).eq("type", "want");
      toast.success("Removed from wishlist");
    } else {
      await supabase.from("card_wishlist").upsert({ user_id: user.id, card_id: cardId, type: "want" });
      toast.success("Added to wishlist");
    }
    refetchWanted();
  };

  const submitComment = async () => {
    if (!user || !cardId || !commentText.trim()) return;
    const { error } = await supabase.from("card_comments").insert({
      card_id: cardId,
      user_id: user.id,
      content: commentText.trim().slice(0, 500),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setCommentText("");
    refetchComments();
  };

  const deleteComment = async (id: string) => {
    await supabase.from("card_comments").delete().eq("id", id);
    refetchComments();
  };

  return (
    <Dialog open={!!cardId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0">
        {card ? (
          <div className="flex flex-col">
            {/* Top: card */}
            <div className="flex flex-col items-center gap-2 p-4 pb-2">
              <CardDisplay card={card} size="lg" />
              <h2 className="text-lg font-bold">{card.character_name}</h2>
              {card.series?.slug && (
                <Link
                  to="/series/$slug"
                  params={{ slug: card.series.slug }}
                  className="text-xs text-primary hover:underline"
                  onClick={onClose}
                >
                  {card.series.title}
                </Link>
              )}
              {submitter?.username && (
                <p className="text-[10px] text-muted-foreground">Author: @{submitter.username}</p>
              )}
            </div>

            {/* Action icons */}
            <div className="flex items-center justify-around border-y border-border bg-secondary/30 px-2 py-3">
              <ActionButton icon={Flag} label="Report" onClick={() => toast.info("Image suggestion form coming soon")} />
              <ActionButton icon={Users} label={`${ownerCount}`} onClick={() => setActiveTab("lots")} />
              <ActionButton
                icon={Heart}
                label={isWanted ? "Wanted" : "Want"}
                onClick={toggleWishlist}
                active={isWanted}
              />
              {userOwnsCard && (
                <ActionButton icon={ArrowLeftRight} label="Trade" onClick={() => toast.info("Trade ready toggle coming soon")} />
              )}
              <ActionButton icon={Gift} label="Offer" onClick={() => toast.info("Offer composer coming soon")} />
            </div>

            {/* Tabs: Lots / Want / Trade Ready / Requests */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="px-4 pt-3">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="lots" className="text-xs">Lots</TabsTrigger>
                <TabsTrigger value="want" className="text-xs">Want</TabsTrigger>
                <TabsTrigger value="ready" className="text-xs">Ready</TabsTrigger>
                <TabsTrigger value="requests" className="text-xs">Requests</TabsTrigger>
              </TabsList>
              <TabsContent value="lots" className="py-3 text-sm text-muted-foreground">
                Marketplace lots will be listed here.
              </TabsContent>
              <TabsContent value="want" className="py-3 text-sm text-muted-foreground">
                Users wishing for this card will appear here.
              </TabsContent>
              <TabsContent value="ready" className="py-3 text-sm text-muted-foreground">
                Owners with trade-ready toggle on will appear here.
              </TabsContent>
              <TabsContent value="requests" className="py-3 text-sm text-muted-foreground">
                Buy requests for this card will appear here.
              </TabsContent>
            </Tabs>

            {/* Owners */}
            <div className="px-4 pb-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {ownerCount} owner{ownerCount === 1 ? "" : "s"}
              </div>
              <div className="flex flex-wrap gap-1">
                {ownersList.map((o: any) => (
                  <Link
                    key={o.user_id}
                    to="/profile/$username"
                    params={{ username: o.profile.username }}
                    onClick={onClose}
                    className="block h-7 w-7 overflow-hidden rounded-full bg-primary text-[10px] font-bold text-primary-foreground"
                  >
                    {o.profile.avatar_url ? (
                      <img src={o.profile.avatar_url} alt={o.profile.username} className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center">
                        {o.profile.username?.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </Link>
                ))}
                {ownerCount === 0 && <span className="text-xs text-muted-foreground">No owners yet</span>}
              </div>
            </div>

            {/* Comments */}
            <div className="border-t border-border p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Comments</div>
              {user && (
                <div className="mb-3 flex gap-2">
                  <input
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") submitComment(); }}
                    placeholder="Leave a comment…"
                    maxLength={500}
                    className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
                  />
                  <Button size="sm" onClick={submitComment} disabled={!commentText.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <div className="space-y-2">
                {comments.length === 0 && (
                  <p className="text-xs text-muted-foreground">No comments yet.</p>
                )}
                {comments.map((c: any) => (
                  <div key={c.id} className="flex items-start gap-2">
                    <div className="h-7 w-7 flex-shrink-0 overflow-hidden rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      {c.profile?.avatar_url ? (
                        <img src={c.profile.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center">
                          {c.profile?.username?.slice(0, 2).toUpperCase() ?? "?"}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 rounded-md bg-secondary/50 px-3 py-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">@{c.profile?.username ?? "anon"}</span>
                        {user?.id === c.user_id && (
                          <button onClick={() => deleteComment(c.id)} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-sm">{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6">
            <div className="h-56 animate-pulse rounded-xl bg-secondary" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  active,
}: {
  icon: typeof X;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 rounded-md px-2 py-1 text-[10px] transition-colors hover:bg-secondary",
        active && "text-primary",
      )}
    >
      <Icon className={cn("h-5 w-5", active && "fill-current")} />
      <span>{label}</span>
    </button>
  );
}
