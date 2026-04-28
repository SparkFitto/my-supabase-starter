import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Pin, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { timeAgo } from "@/lib/constants";
import { toast } from "sonner";

type WallComment = {
  id: string;
  profile_user_id: string;
  author_user_id: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
  author?: { username: string | null; avatar_url: string | null } | null;
};

export function SocialTab({
  profileId,
  username,
  isOwn,
  viewerId,
  friendsArePrivate,
}: {
  profileId: string;
  username: string;
  isOwn: boolean;
  viewerId: string | null;
  friendsArePrivate: boolean;
}) {
  // Friends list
  const [friends, setFriends] = useState<any[]>([]);
  useEffect(() => {
    if (!isOwn && friendsArePrivate) return;
    (async () => {
      const { data } = await supabase
        .from("friendships")
        .select("requester_id, addressee_id, accepted_at")
        .eq("status", "accepted")
        .or(`requester_id.eq.${profileId},addressee_id.eq.${profileId}`)
        .order("accepted_at", { ascending: false, nullsFirst: false });
      const ids = (data ?? []).map((f: any) =>
        f.requester_id === profileId ? f.addressee_id : f.requester_id,
      );
      if (!ids.length) { setFriends([]); return; }
      const { data: profs } = await supabase
        .from("user_profiles")
        .select("id, username, avatar_url, last_seen")
        .in("id", ids);
      setFriends(profs ?? []);
    })();
  }, [profileId, isOwn, friendsArePrivate]);

  // Wall
  const [wall, setWall] = useState<WallComment[]>([]);
  const [text, setText] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("profile_comments")
        .select("*")
        .eq("profile_user_id", profileId)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100);
      const list = (data ?? []) as WallComment[];
      const ids = Array.from(new Set(list.map((c) => c.author_user_id)));
      let map: Record<string, { username: string | null; avatar_url: string | null }> = {};
      if (ids.length) {
        const { data: profs } = await supabase
          .from("user_profiles")
          .select("id, username, avatar_url")
          .in("id", ids);
        map = Object.fromEntries((profs ?? []).map((p) => [p.id, { username: p.username, avatar_url: p.avatar_url }]));
      }
      setWall(list.map((c) => ({ ...c, author: map[c.author_user_id] ?? null })));
    };
    load();
    const channel = supabase
      .channel(`wall:${profileId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profile_comments", filter: `profile_user_id=eq.${profileId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profileId]);

  const postWall = async () => {
    if (!viewerId || !text.trim()) return;
    const { error } = await supabase.from("profile_comments").insert({
      profile_user_id: profileId, author_user_id: viewerId, content: text.trim().slice(0, 1000),
    });
    if (error) toast.error(error.message);
    else { setText(""); toast.success("Posted"); }
  };

  const removeWall = async (id: string) => {
    await supabase.from("profile_comments").delete().eq("id", id);
  };

  const togglePin = async (id: string, pinned: boolean) => {
    await supabase.from("profile_comments").update({ is_pinned: !pinned }).eq("id", id);
  };

  return (
    <div className="space-y-8">
      {/* FRIENDS */}
      <section>
        <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">
          Friends {friends.length ? `(${friends.length})` : ""}
        </h3>
        {!isOwn && friendsArePrivate ? (
          <p className="text-sm text-muted-foreground">Friends list is private</p>
        ) : friends.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No friends yet. {isOwn && <Link to="/friends" className="text-primary hover:underline">Find friends →</Link>}
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {friends.map((f) => (
              <Link
                key={f.id}
                to="/profile/$username"
                params={{ username: f.username ?? "" }}
                className="flex items-center gap-3 rounded-lg border border-border bg-card/40 p-2.5 hover:border-primary/50"
              >
                <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold overflow-hidden">
                  {f.avatar_url ? <img src={f.avatar_url} alt="" className="h-full w-full object-cover" /> : (f.username ?? "?").slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">@{f.username}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* WALL */}
      <section>
        <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">
          Wall {wall.length ? `(${wall.length})` : ""}
        </h3>
        {viewerId && (
          <div className="rounded-lg border border-border bg-card/40 p-3 mb-4">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 1000))}
              placeholder={isOwn ? "Post an update…" : `Write something on @${username}'s wall…`}
              rows={2}
            />
            <div className="mt-2 flex justify-between items-center">
              <span className="text-xs text-muted-foreground">{text.length}/1000</span>
              <Button size="sm" onClick={postWall} disabled={!text.trim()}>Post</Button>
            </div>
          </div>
        )}
        {wall.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing on the wall yet.</p>
        ) : (
          <div className="space-y-3">
            {wall.map((c) => (
              <div key={c.id} className={`rounded-lg border p-3 ${c.is_pinned ? "border-warning/50 bg-warning/5" : "border-border bg-card/40"}`}>
                <div className="flex items-start gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={c.author?.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[10px]">{(c.author?.username ?? "?")[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {c.author?.username ? (
                        <Link to="/profile/$username" params={{ username: c.author.username }} className="font-medium text-foreground hover:text-primary">
                          @{c.author.username}
                        </Link>
                      ) : <span>unknown</span>}
                      <span>·</span><span>{timeAgo(c.created_at)}</span>
                      {c.is_pinned && <span className="flex items-center gap-1 text-warning"><Pin className="h-3 w-3" />Pinned</span>}
                    </div>
                    <p className="mt-1 text-sm whitespace-pre-wrap break-words">{c.content}</p>
                  </div>
                  {viewerId && (viewerId === c.author_user_id || isOwn) && (
                    <div className="flex flex-col gap-1">
                      {isOwn && (
                        <button onClick={() => togglePin(c.id, c.is_pinned)} className="p-1 text-muted-foreground hover:text-warning" title="Pin/unpin">
                          <Pin className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button onClick={() => removeWall(c.id)} className="p-1 text-muted-foreground hover:text-destructive" title="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
