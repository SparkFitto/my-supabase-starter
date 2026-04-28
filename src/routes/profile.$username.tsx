import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { UserPlus, UserCheck, UserX, MessageSquare, Pin, Trash2 } from "lucide-react";
import { timeAgo } from "@/lib/constants";
import { toast } from "sonner";

export const Route = createFileRoute("/profile/$username")({
  head: ({ params }) => ({ meta: [{ title: `@${params.username} — RAWL` }] }),
  component: PublicProfilePage,
});

type WallComment = {
  id: string;
  profile_user_id: string;
  author_user_id: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
  author?: { username: string | null; avatar_url: string | null } | null;
};

function PublicProfilePage() {
  const { username } = Route.useParams();
  const { user } = useAuth();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["public-profile", username],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("id, username, avatar_url, bio, chapters_translated_total, login_streak, last_seen, plan, friends_are_private")
        .ilike("username", username)
        .maybeSingle();
      return data;
    },
  });

  const profileId = profile?.id;
  const isOwn = user?.id === profileId;

  // friendship status (between viewer and profile owner)
  const [friendship, setFriendship] = useState<{ id: string; status: string; requester_id: string } | null>(null);
  useEffect(() => {
    if (!user || !profileId || isOwn) { setFriendship(null); return; }
    (async () => {
      const { data } = await supabase
        .from("friendships")
        .select("id, status, requester_id")
        .or(`and(requester_id.eq.${user.id},addressee_id.eq.${profileId}),and(requester_id.eq.${profileId},addressee_id.eq.${user.id})`)
        .maybeSingle();
      setFriendship(data as any);
    })();
  }, [user?.id, profileId, isOwn]);

  // friends count
  const { data: friendCount = 0 } = useQuery({
    queryKey: ["friend-count", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { count } = await supabase
        .from("friendships")
        .select("*", { count: "exact", head: true })
        .eq("status", "accepted")
        .or(`requester_id.eq.${profileId},addressee_id.eq.${profileId}`);
      return count ?? 0;
    },
  });

  // wall comments
  const [wall, setWall] = useState<WallComment[]>([]);
  const [text, setText] = useState("");

  useEffect(() => {
    if (!profileId) return;
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
        const { data: profs } = await supabase.from("user_profiles").select("id, username, avatar_url").in("id", ids);
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

  const sendRequest = async () => {
    if (!user || !profileId) return;
    const { error } = await supabase.from("friendships").insert({
      requester_id: user.id, addressee_id: profileId, status: "pending",
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Request sent");
      await supabase.from("notifications").insert({
        user_id: profileId, type: "friend_request", title: "New friend request", body: `@${user.user_metadata?.username ?? "Someone"} wants to be friends`, link: "/friends",
      } as any).then(() => {});
      setFriendship({ id: "tmp", status: "pending", requester_id: user.id });
    }
  };

  const acceptRequest = async () => {
    if (!friendship) return;
    await supabase.from("friendships").update({ status: "accepted", accepted_at: new Date().toISOString() }).eq("id", friendship.id);
    setFriendship({ ...friendship, status: "accepted" });
    toast.success("Friend added");
  };

  const removeFriend = async () => {
    if (!friendship) return;
    await supabase.from("friendships").delete().eq("id", friendship.id);
    setFriendship(null);
  };

  const startMessage = async () => {
    if (!user || !profileId) return;
    const a = user.id < profileId ? user.id : profileId;
    const b = user.id < profileId ? profileId : user.id;
    const { data: existing } = await supabase
      .from("conversations").select("id")
      .or(`and(user1_id.eq.${a},user2_id.eq.${b}),and(user1_id.eq.${b},user2_id.eq.${a})`)
      .maybeSingle();
    if (!existing) {
      await supabase.from("conversations").insert({ user1_id: a, user2_id: b });
    }
    window.location.href = "/messages";
  };

  const postWall = async () => {
    if (!user || !profileId || !text.trim()) return;
    const { error } = await supabase.from("profile_comments").insert({
      profile_user_id: profileId, author_user_id: user.id, content: text.trim().slice(0, 1000),
    });
    if (error) toast.error(error.message);
    else {
      setText("");
      if (!isOwn) {
        await supabase.from("notifications").insert({
          user_id: profileId, type: "wall", title: "New wall post", body: text.trim().slice(0, 80), link: `/profile/${username}`,
        } as any).then(() => {});
      }
    }
  };

  const removeWall = async (id: string) => {
    await supabase.from("profile_comments").delete().eq("id", id);
  };

  const togglePin = async (id: string, pinned: boolean) => {
    await supabase.from("profile_comments").update({ is_pinned: !pinned }).eq("id", id);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-6">
        {isLoading ? (
          <div className="space-y-4"><Skeleton className="h-32 w-full rounded-xl" /><Skeleton className="h-20 w-full rounded-xl" /></div>
        ) : !profile ? (
          <div className="text-center py-20">
            <h1 className="text-xl font-semibold">User not found</h1>
            <p className="text-sm text-muted-foreground mt-2">No user named @{username}.</p>
            <Link to="/" className="text-primary hover:underline text-sm mt-4 inline-block">← Back home</Link>
          </div>
        ) : (
          <>
            <div className="rounded-xl bg-gradient-to-br from-primary/30 to-purple-500/20 p-6 flex flex-col items-center text-center border border-border">
              <div className="h-20 w-20 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold overflow-hidden ring-4 ring-background">
                {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : (profile.username ?? "?").slice(0, 2).toUpperCase()}
              </div>
              <h1 className="mt-3 text-xl font-bold">@{profile.username}</h1>
              <span className="text-[10px] uppercase tracking-wide text-primary font-bold mt-0.5">{profile.plan}</span>

              {!isOwn && user && (
                <div className="mt-4 flex gap-2">
                  {!friendship && (
                    <Button size="sm" onClick={sendRequest}><UserPlus className="h-4 w-4 mr-1" />Add friend</Button>
                  )}
                  {friendship?.status === "pending" && friendship.requester_id === user.id && (
                    <Button size="sm" variant="outline" disabled><UserCheck className="h-4 w-4 mr-1" />Request sent</Button>
                  )}
                  {friendship?.status === "pending" && friendship.requester_id !== user.id && (
                    <Button size="sm" onClick={acceptRequest}><UserCheck className="h-4 w-4 mr-1" />Accept request</Button>
                  )}
                  {friendship?.status === "accepted" && (
                    <Button size="sm" variant="outline" onClick={removeFriend}><UserX className="h-4 w-4 mr-1" />Friends</Button>
                  )}
                  <Button size="sm" variant="secondary" onClick={startMessage}><MessageSquare className="h-4 w-4 mr-1" />Message</Button>
                </div>
              )}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-card border border-border p-3 text-center">
                <div className="text-lg font-bold">{profile.chapters_translated_total ?? 0}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Translations</div>
              </div>
              <div className="rounded-lg bg-card border border-border p-3 text-center">
                <div className="text-lg font-bold">{profile.login_streak ?? 0}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Day Streak</div>
              </div>
              <div className="rounded-lg bg-card border border-border p-3 text-center">
                <div className="text-lg font-bold">{profile.friends_are_private && !isOwn ? "—" : friendCount}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Friends</div>
              </div>
            </div>

            {profile.bio && <div className="mt-4 rounded-lg bg-card border border-border p-4 text-sm">{profile.bio}</div>}

            {/* Wall */}
            <section className="mt-8">
              <h2 className="text-lg font-semibold mb-3">Wall</h2>
              {user && (
                <div className="rounded-lg border border-border bg-card p-3 mb-4">
                  <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={isOwn ? "Post an update…" : `Write something on @${profile.username}'s wall…`} rows={2} />
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
                    <div key={c.id} className={`rounded-lg border p-3 ${c.is_pinned ? "border-warning/50 bg-warning/5" : "border-border bg-card"}`}>
                      <div className="flex items-start gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={c.author?.avatar_url ?? undefined} />
                          <AvatarFallback className="text-[10px]">{(c.author?.username ?? "?")[0]?.toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {c.author?.username ? (
                              <Link to="/profile/$username" params={{ username: c.author.username }} className="font-medium text-foreground hover:text-primary">@{c.author.username}</Link>
                            ) : <span>unknown</span>}
                            <span>·</span><span>{timeAgo(c.created_at)}</span>
                            {c.is_pinned && <span className="flex items-center gap-1 text-warning"><Pin className="h-3 w-3" />Pinned</span>}
                          </div>
                          <p className="mt-1 text-sm whitespace-pre-wrap break-words">{c.content}</p>
                        </div>
                        {user && (user.id === c.author_user_id || isOwn) && (
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
          </>
        )}
      </main>
    </div>
  );
}
