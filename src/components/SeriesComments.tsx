import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowBigUp, ArrowBigDown, MessageSquare, Pin, Trash2, Reply } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { timeAgo } from "@/lib/constants";
import { toast } from "sonner";
import { useInkRewards } from "@/hooks/useInkRewards";
import { notify } from "@/lib/notify";

const VOTE_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24h
const DAILY_DOWNVOTE_LIMIT = 15;

type Comment = {
  id: string;
  content: string;
  created_at: string;
  is_pinned: boolean;
  parent_id: string | null;
  user_id: string;
  series_id: string;
  author?: { username: string | null; avatar_url: string | null } | null;
};

type Vote = { comment_id: string; vote_type: "up" | "down"; created_at: string };

export function SeriesComments({ seriesId }: { seriesId: string }) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [votes, setVotes] = useState<Record<string, { up: number; down: number }>>({});
  const [myVotes, setMyVotes] = useState<Record<string, Vote>>({});
  const [downvotesUsedToday, setDownvotesUsedToday] = useState(0);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(true);

  // initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("series_comments")
        .select("id, content, created_at, is_pinned, parent_id, user_id, series_id")
        .eq("series_id", seriesId)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false });
      if (cancelled) return;
      const list = (data ?? []) as Comment[];

      // hydrate authors
      const userIds = Array.from(new Set(list.map((c) => c.user_id)));
      let profileMap: Record<string, { username: string | null; avatar_url: string | null }> = {};
      if (userIds.length) {
        const { data: profiles } = await supabase
          .from("user_profiles")
          .select("id, username, avatar_url")
          .in("id", userIds);
        profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, { username: p.username, avatar_url: p.avatar_url }]));
      }
      setComments(list.map((c) => ({ ...c, author: profileMap[c.user_id] ?? null })));

      // votes
      const ids = list.map((c) => c.id);
      if (ids.length) {
        const { data: voteRows } = await supabase
          .from("comment_votes")
          .select("comment_id, vote_type, user_id, created_at")
          .eq("comment_type", "series")
          .in("comment_id", ids);
        const counts: Record<string, { up: number; down: number }> = {};
        const mine: Record<string, Vote> = {};
        for (const v of voteRows ?? []) {
          counts[v.comment_id] ||= { up: 0, down: 0 };
          if (v.vote_type === "up") counts[v.comment_id].up++;
          else counts[v.comment_id].down++;
          if (user && v.user_id === user.id) {
            mine[v.comment_id] = { comment_id: v.comment_id, vote_type: v.vote_type as "up" | "down", created_at: v.created_at };
          }
        }
        setVotes(counts);
        setMyVotes(mine);
      }
      setLoading(false);
    })();

    // realtime
    const channel = supabase
      .channel(`series_comments:${seriesId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "series_comments", filter: `series_id=eq.${seriesId}` },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            const c = payload.new as Comment;
            const { data: prof } = await supabase.from("user_profiles").select("username, avatar_url").eq("id", c.user_id).maybeSingle();
            setComments((prev) => [{ ...c, author: prof ?? null }, ...prev.filter((x) => x.id !== c.id)]);
          } else if (payload.eventType === "DELETE") {
            setComments((prev) => prev.filter((c) => c.id !== (payload.old as Comment).id));
          } else if (payload.eventType === "UPDATE") {
            const c = payload.new as Comment;
            setComments((prev) => prev.map((x) => (x.id === c.id ? { ...x, ...c } : x)));
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comment_votes", filter: `comment_type=eq.series` },
        (payload) => {
          const row = (payload.new ?? payload.old) as { comment_id: string; vote_type: string };
          if (!row?.comment_id) return;
          // recompute counts for that comment
          (async () => {
            const { data } = await supabase
              .from("comment_votes")
              .select("vote_type")
              .eq("comment_type", "series")
              .eq("comment_id", row.comment_id);
            const up = (data ?? []).filter((v) => v.vote_type === "up").length;
            const down = (data ?? []).filter((v) => v.vote_type === "down").length;
            setVotes((prev) => ({ ...prev, [row.comment_id]: { up, down } }));
          })();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [seriesId, user?.id]);

  // load downvote quota from profile
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("daily_downvotes_used, downvotes_reset_at")
        .eq("id", user.id)
        .maybeSingle();
      if (!data) return;
      const resetAt = data.downvotes_reset_at ? new Date(data.downvotes_reset_at).getTime() : 0;
      if (Date.now() - resetAt > 24 * 60 * 60 * 1000) {
        setDownvotesUsedToday(0);
      } else {
        setDownvotesUsedToday(data.daily_downvotes_used ?? 0);
      }
    })();
  }, [user?.id]);

  const tree = useMemo(() => {
    const byParent: Record<string, Comment[]> = {};
    for (const c of comments) {
      const key = c.parent_id ?? "root";
      (byParent[key] ||= []).push(c);
    }
    return byParent;
  }, [comments]);

  const submit = async (parentId: string | null, body: string) => {
    if (!user) {
      toast.error("Sign in to comment");
      return;
    }
    const trimmed = body.trim();
    if (!trimmed) return;
    if (trimmed.length > 2000) {
      toast.error("Comment too long (max 2000)");
      return;
    }
    const { error } = await supabase.from("series_comments").insert({
      series_id: seriesId,
      user_id: user.id,
      content: trimmed,
      parent_id: parentId,
    });
    if (error) toast.error(error.message);
    else {
      if (parentId) {
        setReplyText("");
        setReplyTo(null);
      } else setText("");
    }
  };

  const vote = async (commentId: string, type: "up" | "down") => {
    if (!user) {
      toast.error("Sign in to vote");
      return;
    }
    const existing = myVotes[commentId];

    // remove same vote (toggle off)
    if (existing && existing.vote_type === type) {
      await supabase.from("comment_votes").delete().eq("comment_id", commentId).eq("user_id", user.id).eq("comment_type", "series");
      setMyVotes((prev) => {
        const n = { ...prev };
        delete n[commentId];
        return n;
      });
      return;
    }

    // 24h cooldown when changing your vote
    if (existing) {
      const elapsed = Date.now() - new Date(existing.created_at).getTime();
      if (elapsed < VOTE_COOLDOWN_MS) {
        const hrs = Math.ceil((VOTE_COOLDOWN_MS - elapsed) / 3_600_000);
        toast.error(`You can change this vote in ~${hrs}h`);
        return;
      }
    }

    // daily downvote limit
    if (type === "down") {
      if (downvotesUsedToday >= DAILY_DOWNVOTE_LIMIT) {
        toast.error(`Daily downvote limit reached (${DAILY_DOWNVOTE_LIMIT}/day)`);
        return;
      }
    }

    if (existing) {
      await supabase
        .from("comment_votes")
        .update({ vote_type: type, created_at: new Date().toISOString() })
        .eq("comment_id", commentId)
        .eq("user_id", user.id)
        .eq("comment_type", "series");
    } else {
      const { error } = await supabase.from("comment_votes").insert({
        comment_id: commentId,
        comment_type: "series",
        user_id: user.id,
        vote_type: type,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
    }

    setMyVotes((prev) => ({ ...prev, [commentId]: { comment_id: commentId, vote_type: type, created_at: new Date().toISOString() } }));

    if (type === "down") {
      const newUsed = downvotesUsedToday + 1;
      setDownvotesUsedToday(newUsed);
      await supabase
        .from("user_profiles")
        .update({ daily_downvotes_used: newUsed, downvotes_reset_at: new Date().toISOString() })
        .eq("id", user.id);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this comment?")) return;
    const { error } = await supabase.from("series_comments").delete().eq("id", id);
    if (error) toast.error(error.message);
  };

  const renderNode = (c: Comment, depth: number) => {
    const v = votes[c.id] ?? { up: 0, down: 0 };
    const score = v.up - v.down;
    const mine = myVotes[c.id];
    const children = tree[c.id] ?? [];
    return (
      <div key={c.id} className={depth > 0 ? "ml-6 mt-3 border-l border-border pl-3" : "border-t border-border pt-4 mt-4 first:border-t-0 first:mt-0 first:pt-0"}>
        <div className="flex gap-3">
          <div className="flex flex-col items-center gap-0.5 pt-0.5">
            <button
              onClick={() => vote(c.id, "up")}
              className={`p-0.5 rounded hover:bg-muted ${mine?.vote_type === "up" ? "text-primary" : "text-muted-foreground"}`}
              aria-label="Upvote"
            >
              <ArrowBigUp className="h-5 w-5" fill={mine?.vote_type === "up" ? "currentColor" : "none"} />
            </button>
            <span className={`text-xs font-mono font-semibold ${score > 0 ? "text-primary" : score < 0 ? "text-destructive" : "text-muted-foreground"}`}>{score}</span>
            <button
              onClick={() => vote(c.id, "down")}
              className={`p-0.5 rounded hover:bg-muted ${mine?.vote_type === "down" ? "text-destructive" : "text-muted-foreground"}`}
              aria-label="Downvote"
            >
              <ArrowBigDown className="h-5 w-5" fill={mine?.vote_type === "down" ? "currentColor" : "none"} />
            </button>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Avatar className="h-6 w-6">
                <AvatarImage src={c.author?.avatar_url ?? undefined} />
                <AvatarFallback className="text-[10px]">{(c.author?.username ?? "?")[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              {c.author?.username ? (
                <Link to="/profile/$username" params={{ username: c.author.username }} className="font-medium text-foreground hover:text-primary">
                  {c.author.username}
                </Link>
              ) : (
                <span className="font-medium text-foreground">unknown</span>
              )}
              <span>·</span>
              <span>{timeAgo(c.created_at)}</span>
              {c.is_pinned && (
                <span className="flex items-center gap-1 text-warning"><Pin className="h-3 w-3" />Pinned</span>
              )}
            </div>
            <p className="mt-1.5 text-sm whitespace-pre-wrap break-words">{c.content}</p>
            <div className="mt-2 flex gap-3 text-xs">
              <button onClick={() => setReplyTo(replyTo === c.id ? null : c.id)} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
                <Reply className="h-3.5 w-3.5" />Reply
              </button>
              {user?.id === c.user_id && (
                <button onClick={() => remove(c.id)} className="flex items-center gap-1 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />Delete
                </button>
              )}
            </div>
            {replyTo === c.id && (
              <div className="mt-2 flex flex-col gap-2">
                <Textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Write a reply…" rows={2} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => submit(c.id, replyText)}>Reply</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setReplyTo(null); setReplyText(""); }}>Cancel</Button>
                </div>
              </div>
            )}
            {children.length > 0 && depth < 4 && (
              <div>{children.map((child) => renderNode(child, depth + 1))}</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const roots = tree["root"] ?? [];

  return (
    <div>
      <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
        <MessageSquare className="h-5 w-5" />
        Comments <span className="text-sm font-normal text-muted-foreground">({comments.length})</span>
      </h2>

      {user ? (
        <div className="mb-6 rounded-lg border border-border bg-card p-3">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Share your thoughts about this series…" rows={3} />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{text.length}/2000</span>
            <Button onClick={() => submit(null, text)} disabled={!text.trim()}>Post</Button>
          </div>
        </div>
      ) : (
        <div className="mb-6 rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          <Link to="/signin" className="text-primary hover:underline">Sign in</Link> to join the conversation.
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading comments…</p>
      ) : roots.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet — be the first!</p>
      ) : (
        <div>{roots.map((c) => renderNode(c, 0))}</div>
      )}
    </div>
  );
}
