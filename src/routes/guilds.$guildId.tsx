import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Crown, Settings, Swords, X } from "lucide-react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { addMember, removeMember, levelProgress, timeRemaining, grantCardToUser, removeCardFromUser, notifyGuild } from "@/lib/guilds";
import { notify } from "@/lib/notify";
import { CardDisplay } from "@/components/cards/CardDisplay";

const REWARD_MILESTONES = [
  { xp: 1000,  type: "ink"  as const, amount: 80,   label: "80 Ink",  rank: null as string | null },
  { xp: 3000,  type: "card" as const, amount: null, label: "C Card",  rank: "C" as string | null },
  { xp: 5000,  type: "ink"  as const, amount: 80,   label: "80 Ink",  rank: null as string | null },
  { xp: 7000,  type: "card" as const, amount: null, label: "B Card",  rank: "B" as string | null },
  { xp: 9000,  type: "ink"  as const, amount: 85,   label: "85 Ink",  rank: null as string | null },
  { xp: 11000, type: "card" as const, amount: null, label: "A Card",  rank: "A" as string | null },
  { xp: 13000, type: "ink"  as const, amount: 90,   label: "90 Ink",  rank: null as string | null },
  { xp: 15000, type: "card" as const, amount: null, label: "S Card",  rank: "S" as string | null },
];
const CYCLE_LENGTH = 15000;

export const Route = createFileRoute("/guilds/$guildId")({
  head: ({ params }) => ({
    meta: [
      { title: "Guild — RAWL" },
      { name: "description", content: `Guild profile on RAWL.` },
      { property: "og:title", content: "Guild — RAWL" },
    ],
  }),
  component: GuildDetailPage,
});

type Tab = "members" | "chest" | "wars" | "relations" | "activity";

function GuildDetailPage() {
  const { guildId } = Route.useParams();
  const { user, profile, refreshProfile } = useAuth();
  const nav = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("members");
  const [showSettings, setShowSettings] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [commentSort, setCommentSort] = useState<"new" | "popular">("new");
  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const { data: guild, isLoading, refetch: refetchGuild } = useQuery({
    queryKey: ["guild", guildId],
    queryFn: async () => {
      const { data } = await supabase.from("guilds").select("*").eq("id", guildId).maybeSingle();
      return data;
    },
  });

  const { data: members = [], refetch: refetchMembers } = useQuery({
    queryKey: ["guild-members", guildId],
    queryFn: async () => {
      const { data } = await supabase
        .from("guild_members")
        .select("*")
        .eq("guild_id", guildId)
        .order("total_xp_contributed", { ascending: false });
      if (!data) return [];
      const ids = (data as any[]).map((m) => m.user_id);
      const { data: profs } = await supabase.from("user_profiles").select("id, username, avatar_url").in("id", ids);
      const pMap = new Map((profs ?? []).map((p: any) => [p.id, p]));
      return (data as any[]).map((m) => ({ ...m, profile: pMap.get(m.user_id) }));
    },
  });

  const { data: relations = [] } = useQuery({
    queryKey: ["guild-relations", guildId],
    queryFn: async () => {
      const { data } = await supabase.from("guild_relations").select("*").eq("guild_id", guildId);
      if (!data) return [];
      const ids = (data as any[]).map((r) => r.target_guild_id);
      const { data: gs } = await supabase.from("guilds").select("id, name, avatar_url, level, member_count").in("id", ids);
      const gMap = new Map((gs ?? []).map((g: any) => [g.id, g]));
      return (data as any[]).map((r) => ({ ...r, target: gMap.get(r.target_guild_id) }));
    },
  });

  const { data: activeWar } = useQuery({
    queryKey: ["guild-active-war", guildId],
    queryFn: async () => {
      const { data } = await supabase
        .from("guild_wars")
        .select("*")
        .eq("status", "active")
        .or(`guild_a_id.eq.${guildId},guild_b_id.eq.${guildId}`)
        .maybeSingle();
      if (!data) return null;
      const otherId = (data as any).guild_a_id === guildId ? (data as any).guild_b_id : (data as any).guild_a_id;
      const [{ data: other }, { data: series }] = await Promise.all([
        supabase.from("guilds").select("id, name, avatar_url").eq("id", otherId).maybeSingle(),
        supabase.from("series").select("id, title, slug").eq("id", (data as any).series_id).maybeSingle(),
      ]);
      return { ...(data as any), other, series };
    },
  });

  // Realtime: war updates
  useEffect(() => {
    if (!activeWar?.id) return;
    const ch = supabase
      .channel(`war:${activeWar.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "guild_wars", filter: `id=eq.${activeWar.id}` }, () => {
        // refetch
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeWar?.id]);

  const isMember = !!members.find((m: any) => m.user_id === user?.id);
  const myMember = members.find((m: any) => m.user_id === user?.id);
  const isLeader = !!(guild && user && (guild as any).leader_id === user.id);
  const isOfficer = myMember?.role === "officer";
  const inAnotherGuild = !!(profile as any)?.guild_id && (profile as any).guild_id !== guildId;

  // Announcements
  const { data: announcements = [], refetch: refetchAnnouncements } = useQuery({
    queryKey: ["guild-announcements", guildId],
    queryFn: async () => {
      const { data } = await supabase
        .from("guild_announcements")
        .select("*")
        .eq("guild_id", guildId)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`guild-ann-${guildId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "guild_announcements", filter: `guild_id=eq.${guildId}` },
        () => refetchAnnouncements(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [guildId, refetchAnnouncements]);

  // Member XP for reward strip
  const { data: memberRow } = useQuery({
    queryKey: ["guild-member-row", guildId, user?.id],
    enabled: isMember && !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("guild_members")
        .select("total_xp_contributed")
        .eq("guild_id", guildId)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: rewardRow, refetch: refetchRewards } = useQuery({
    queryKey: ["guild-member-rewards", guildId, user?.id],
    enabled: isMember && !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("guild_member_rewards")
        .select("last_reward_threshold, total_xp_for_rewards")
        .eq("guild_id", guildId)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const totalXp = (memberRow as any)?.total_xp_contributed ?? 0;
  const cycleXp = totalXp % CYCLE_LENGTH;
  const cycleNumber = Math.floor(totalXp / CYCLE_LENGTH);
  const lastClaimed = (rewardRow as any)?.last_reward_threshold ?? 0;

  const claimReward = async (m: typeof REWARD_MILESTONES[number]) => {
    if (!user) return;
    try {
      if (m.type === "ink" && m.amount) {
        await supabase.rpc("award_ink" as any, { _amount: m.amount, _source: "guild_reward" } as any);
      }
      if (m.type === "card" && m.rank) {
        const { data: card } = await supabase
          .from("cards")
          .select("id")
          .eq("rank", m.rank)
          .eq("is_approved", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (card) {
          await grantCardToUser(user.id, (card as any).id);
        }
      }
      await supabase
        .from("guild_member_rewards")
        .upsert({
          guild_id: guildId,
          user_id: user.id,
          last_reward_threshold: m.xp,
          total_xp_for_rewards: totalXp,
        } as never, { onConflict: "guild_id,user_id" });
      toast.success(`🎉 Claimed: ${m.label}!`);
      refetchRewards();
      queryClient.invalidateQueries({ queryKey: ["my-cards"] });
      queryClient.invalidateQueries({ queryKey: ["auth-profile"] });
      refreshProfile();
    } catch (e: any) {
      toast.error(e?.message ?? "Claim failed");
    }
  };

  // Comments
  const { data: comments = [], refetch: refetchComments } = useQuery({
    queryKey: ["guild-comments", guildId, commentSort],
    queryFn: async () => {
      let q = supabase
        .from("guild_comments")
        .select("*")
        .eq("guild_id", guildId)
        .is("parent_id", null);
      if (commentSort === "new") q = q.order("created_at", { ascending: false });
      else q = q.order("upvotes", { ascending: false });
      const { data: topLevel } = await q.limit(20);
      if (!topLevel?.length) return [];
      const userIds = Array.from(new Set((topLevel as any[]).map((c) => c.user_id)));
      const [{ data: profs }, { data: nicks }] = await Promise.all([
        supabase.from("user_profiles").select("id, username, avatar_url").in("id", userIds),
        supabase.from("guild_members").select("user_id, guild_nickname").eq("guild_id", guildId).in("user_id", userIds),
      ]);
      const pMap = new Map((profs ?? []).map((p: any) => [p.id, p]));
      const nMap = new Map((nicks ?? []).map((n: any) => [n.user_id, n.guild_nickname]));
      return (topLevel as any[]).map((c) => ({
        ...c,
        profile: pMap.get(c.user_id),
        displayName: nMap.get(c.user_id) || pMap.get(c.user_id)?.username || "Unknown",
        realUsername: pMap.get(c.user_id)?.username,
      }));
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`guild-comments-${guildId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "guild_comments", filter: `guild_id=eq.${guildId}` },
        () => refetchComments(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [guildId, refetchComments]);

  const sendComment = async (parentId: string | null = null) => {
    const text = parentId ? replyText : commentText;
    if (!text.trim() || !user) return;
    setSendingComment(true);
    const { error } = await supabase.from("guild_comments").insert({
      guild_id: guildId,
      user_id: user.id,
      content: text.trim(),
      parent_id: parentId ?? null,
    } as never);
    setSendingComment(false);
    if (error) { toast.error(error.message); return; }
    if (parentId) { setReplyText(""); setReplyingTo(null); } else setCommentText("");
    refetchComments();
    const gId = (profile as any)?.guild_id;
    if (gId === guildId && user) {
      supabase.rpc("award_guild_xp" as any, {
        _guild_id: gId, _user_id: user.id, _amount: 1,
        _source: "comment", _description: "Posted a comment",
      } as any).then(() => {}, () => {});
    }
  };

  const voteComment = async (commentId: string, type: "up" | "down") => {
    const col = type === "up" ? "upvotes" : "downvotes";
    const { data: row } = await supabase.from("guild_comments").select(`id, ${col}`).eq("id", commentId).maybeSingle();
    if (!row) return;
    const next = ((row as any)[col] ?? 0) + 1;
    await supabase.from("guild_comments").update({ [col]: next } as never).eq("id", commentId);
    refetchComments();
  };

  const deleteCommentRow = async (commentId: string) => {
    await supabase.from("guild_comments").delete().eq("id", commentId);
    refetchComments();
  };

  const postAnnouncement = async (content: string, isPinned: boolean) => {
    if (!user) return;
    const { error } = await supabase.from("guild_announcements").insert({
      guild_id: guildId,
      author_id: user.id,
      content: content.trim(),
      is_pinned: isPinned,
    } as never);
    if (error) { toast.error(error.message); return; }
    toast.success("Posted!");
    setShowAnnouncementModal(false);
    refetchAnnouncements();
  };

  const deleteAnnouncement = async (id: string) => {
    const { error } = await supabase.from("guild_announcements").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    refetchAnnouncements();
  };

  if (isLoading) {
    return <div className="min-h-screen bg-background"><Header /><div className="p-8 max-w-7xl mx-auto"><Skeleton className="h-[220px]" /></div></div>;
  }
  if (!guild) {
    return <div className="min-h-screen bg-background"><Header /><div className="p-12 text-center text-muted-foreground">Guild not found.</div></div>;
  }
  const g: any = guild;
  const lvl = levelProgress(g.xp, g.level);

  const handleJoinOpen = async () => {
    if (!user) return nav({ to: "/signin" });
    if (inAnotherGuild) return toast.error("Leave your current guild first");
    await addMember({ guild_id: g.id, user_id: user.id });
    toast.success(`Joined ${g.name}!`);
    refreshProfile();
    refetchMembers();
    refetchGuild();
  };

  const handleLeave = async () => {
    if (!user) return;
    if (!confirm("Are you sure? You'll lose your guild card and nickname.")) return;
    await removeMember({ guild_id: g.id, user_id: user.id });
    toast.success(`Left ${g.name}`);
    refreshProfile();
    refetchMembers();
    refetchGuild();
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-6xl">
        {/* HEADER */}
        <div className="relative h-[220px] w-full overflow-hidden">
          {g.banner_url ? (
            <img src={g.banner_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full" style={{
              background: "linear-gradient(135deg, hsl(180 40% 14%), hsl(265 40% 18%))",
              backgroundSize: "300% 300%",
              animation: "rawl-banner-shift 18s ease infinite",
            }} />
          )}
          <style>{`@keyframes rawl-banner-shift { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }`}</style>
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        </div>

        <div className="px-4 sm:px-6 -mt-12 flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="h-[90px] w-[90px] rounded-full bg-secondary border-[3px] border-background overflow-hidden shrink-0">
            {g.avatar_url && <img src={g.avatar_url} alt="" className="h-full w-full object-cover" />}
          </div>
          <div className="flex-1 min-w-0 sm:mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{g.name}</h1>
              <span className="rounded bg-primary/15 text-primary text-[11px] font-bold px-2 py-0.5">Lv. {g.level}</span>
              <span className="text-xs rounded border border-border px-1.5 py-0.5 capitalize">{g.join_type}</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {g.member_count} members · Allies: {relations.filter((r: any) => r.type === "ally").length} · Rivals: {relations.filter((r: any) => r.type === "rival").length}
            </div>
            <div className="mt-2 max-w-md">
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${lvl.pct}%` }} />
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {lvl.isMax ? "Max Level" : `${g.xp.toLocaleString()} / ${lvl.next.toLocaleString()} XP to Lv. ${g.level + 1}`}
              </div>
            </div>
          </div>
          <div className="sm:mb-2 flex gap-2">
            {!isMember && !inAnotherGuild && g.join_type === "open" && (
              <Button onClick={handleJoinOpen}>Join Guild</Button>
            )}
            {!isMember && !inAnotherGuild && g.join_type === "request" && (
              <Button variant="outline" onClick={() => setShowRequest(true)}>Request to Join</Button>
            )}
            {!isMember && g.join_type === "closed" && (
              <Button variant="outline" disabled>Closed</Button>
            )}
            {!isMember && inAnotherGuild && (
              <Button variant="outline" disabled>In another guild</Button>
            )}
            {isMember && !isLeader && (
              <Button variant="outline" className="text-destructive" onClick={handleLeave}>Leave Guild</Button>
            )}
            {isLeader && (
              <Button variant="outline" onClick={() => setShowSettings(true)}><Settings className="h-4 w-4 mr-1" />Settings</Button>
            )}
          </div>
        </div>

        {g.description && <p className="px-4 sm:px-6 mt-4 text-sm text-muted-foreground whitespace-pre-wrap">{g.description}</p>}

        {/* Active war banner */}
        {activeWar && (
          <button
            onClick={() => setTab("wars")}
            className="mx-4 sm:mx-6 mt-4 w-[calc(100%-2rem)] sm:w-[calc(100%-3rem)] rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-left text-sm flex items-center gap-3 hover:bg-destructive/15"
          >
            <Swords className="h-5 w-5 text-destructive shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">War in Progress: {g.name} vs {activeWar.other?.name}</div>
              <div className="text-xs text-muted-foreground truncate">
                📚 {activeWar.series?.title} · {activeWar.guild_a_id === g.id ? activeWar.guild_a_score : activeWar.guild_b_score} — {activeWar.guild_a_id === g.id ? activeWar.guild_b_score : activeWar.guild_a_score} · ⏱ {timeRemaining(activeWar.ends_at)}
              </div>
            </div>
          </button>
        )}

        {/* ANNOUNCEMENTS */}
        {announcements.length > 0 && (
          <div className="mx-4 sm:mx-6 mt-4 rounded-lg border-l-4 border-l-primary border border-border bg-card/40 p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">📢 Announcements</h3>
              {(isLeader || isOfficer) && (
                <button onClick={() => setShowAnnouncementModal(true)} className="text-xs text-primary hover:underline">+ Post</button>
              )}
            </div>
            <div className="space-y-2">
              {(announcements as any[]).map((ann) => (
                <div key={ann.id} className="text-sm">
                  <span className="whitespace-pre-wrap">{ann.is_pinned ? "📌 " : ""}{ann.content}</span>
                  <span className="ml-2 text-[10px] text-muted-foreground">{timeAgo(ann.created_at)}</span>
                  {(isLeader || ann.author_id === user?.id) && (
                    <button onClick={() => deleteAnnouncement(ann.id)} className="ml-2 text-xs text-destructive hover:underline">Delete</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {(isLeader || isOfficer) && announcements.length === 0 && (
          <div className="mx-4 sm:mx-6 mt-4 text-right">
            <button onClick={() => setShowAnnouncementModal(true)} className="text-xs text-primary hover:underline">📢 Post announcement</button>
          </div>
        )}

        {/* REWARD STRIP */}
        {isMember && (
          <div className="mx-4 sm:mx-6 mt-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">🎁 Reward Strip</h3>
              <span className="text-xs text-muted-foreground">Cycle {cycleNumber + 1} · {cycleXp.toLocaleString()} / {CYCLE_LENGTH.toLocaleString()} XP</span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {REWARD_MILESTONES.map((m) => {
                const isClaimed = lastClaimed >= m.xp;
                const isClaimable = cycleXp >= m.xp && !isClaimed;
                const progress = Math.min((cycleXp / m.xp) * 100, 100);
                return (
                  <div key={m.xp} className={`relative shrink-0 w-32 rounded-lg border p-2 ${isClaimed ? "border-emerald-500/40 bg-emerald-500/5" : isClaimable ? "border-primary bg-primary/5" : "border-border bg-card/40"}`}>
                    {isClaimed && <span className="absolute top-1 right-1 text-emerald-400 text-xs">✅</span>}
                    <p className="text-[10px] text-muted-foreground tabular-nums">{m.xp.toLocaleString()} XP</p>
                    <div className="text-xs font-semibold mt-1">{m.type === "ink" ? `🖊️ ${m.label}` : `🎴 ${m.label}`}</div>
                    <div className="mt-2 h-1 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
                    </div>
                    {isClaimable && (
                      <button onClick={() => claimReward(m)} className="mt-1 w-full text-xs bg-primary text-primary-foreground rounded-md py-1 px-2 font-semibold hover:opacity-90">Claim 🎁</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TABS */}
        <div className="mt-6 px-4 sm:px-6 border-b border-border">
          <div className="flex gap-6 overflow-x-auto">
            {(["members", "chest", "wars", "relations", "activity"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`py-3 text-sm font-medium border-b-2 transition-colors capitalize whitespace-nowrap ${
                  tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 sm:px-6 py-6">
          {tab === "members" && (
            <MembersTab
              guildId={g.id}
              members={members as any[]}
              isLeader={!!isLeader}
              isOfficer={isOfficer}
              joinType={g.join_type}
              onChange={() => { refetchMembers(); refetchGuild(); }}
            />
          )}
          {tab === "chest" && (
            <ChestTab
              guildId={g.id}
              members={members as any[]}
              isMember={isMember}
              isLeader={!!isLeader}
              isOfficer={isOfficer}
            />
          )}
          {tab === "wars" && (
            <WarsTab guildId={g.id} guildName={g.name} isLeader={!!isLeader} activeWar={activeWar} />
          )}
          {tab === "relations" && (
            <RelationsTab guildId={g.id} relations={relations as any[]} isLeader={!!isLeader} />
          )}
          {tab === "activity" && <ActivityTab guildId={g.id} />}
        </div>

        {/* COMMENTS */}
        <div className="px-4 sm:px-6 pb-10">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">💬 Comments ({comments.length})</h3>
            <div className="flex gap-1 text-xs">
              <button
                onClick={() => setCommentSort("new")}
                className={`px-2 py-1 rounded ${commentSort === "new" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}
              >New</button>
              <button
                onClick={() => setCommentSort("popular")}
                className={`px-2 py-1 rounded ${commentSort === "popular" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}
              >Popular</button>
            </div>
          </div>

          {user ? (
            <div className="mb-4 flex gap-2">
              <Input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write a comment…"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendComment(null); } }}
              />
              <Button onClick={() => sendComment(null)} disabled={sendingComment || !commentText.trim()}>Post</Button>
            </div>
          ) : (
            <p className="mb-4 text-xs text-muted-foreground">
              <Link to="/signin" className="text-primary hover:underline">Sign in</Link> to comment.
            </p>
          )}

          {comments.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">No comments yet. Be the first!</p>
          ) : (
            <div className="space-y-3">
              {(comments as any[]).map((c) => (
                <div key={c.id} className="rounded-lg border border-border bg-card/40 p-3">
                  <div className="flex items-start gap-2">
                    <div className="h-8 w-8 rounded-full bg-secondary overflow-hidden shrink-0">
                      {c.profile?.avatar_url && <img src={c.profile.avatar_url} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">{c.displayName}</span>
                        {c.realUsername && c.displayName !== c.realUsername && (
                          <span className="text-[10px] text-muted-foreground">@{c.realUsername}</span>
                        )}
                        <span className="text-[10px] text-muted-foreground">{timeAgo(c.created_at)}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap mt-1">{c.content}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs">
                        <button onClick={() => voteComment(c.id, "up")} className="text-muted-foreground hover:text-primary">▲ {c.upvotes ?? 0}</button>
                        <button onClick={() => voteComment(c.id, "down")} className="text-muted-foreground hover:text-destructive">▼ {c.downvotes ?? 0}</button>
                        {user && (
                          <button onClick={() => setReplyingTo(replyingTo === c.id ? null : c.id)} className="text-muted-foreground hover:text-foreground">Reply</button>
                        )}
                        {(isLeader || c.user_id === user?.id) && (
                          <button onClick={() => deleteCommentRow(c.id)} className="text-destructive hover:underline ml-auto">Delete</button>
                        )}
                      </div>
                      {replyingTo === c.id && (
                        <div className="mt-2 flex gap-2">
                          <Input
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Write a reply…"
                            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendComment(c.id); } }}
                          />
                          <Button size="sm" onClick={() => sendComment(c.id)} disabled={sendingComment || !replyText.trim()}>Reply</Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showAnnouncementModal && (isLeader || isOfficer) && (
        <AnnouncementModal
          isLeader={!!isLeader}
          onClose={() => setShowAnnouncementModal(false)}
          onPost={postAnnouncement}
        />
      )}
      {showSettings && isLeader && (
        <SettingsModal
          guild={g}
          onClose={() => setShowSettings(false)}
          onSaved={() => { setShowSettings(false); refetchGuild(); }}
        />
      )}
      {showRequest && user && (
        <RequestModal
          guild={g}
          onClose={() => setShowRequest(false)}
          userId={user.id}
        />
      )}
    </div>
  );
}

// ============ MEMBERS TAB ============
function MembersTab({
  guildId, members, isLeader, isOfficer, joinType, onChange,
}: {
  guildId: string; members: any[]; isLeader: boolean; isOfficer: boolean; joinType: string; onChange: () => void;
}) {
  const { user, refreshProfile } = useAuth();
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
  const [nicknameFor, setNicknameFor] = useState<{ row: any } | null>(null);

  const { data: requests = [], refetch: refetchReq } = useQuery({
    queryKey: ["guild-join-requests", guildId],
    enabled: isLeader || isOfficer,
    queryFn: async () => {
      const { data } = await supabase
        .from("guild_join_requests")
        .select("*")
        .eq("guild_id", guildId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (!data) return [];
      const ids = (data as any[]).map((r) => r.user_id);
      const { data: profs } = await supabase.from("user_profiles").select("id, username, avatar_url").in("id", ids);
      const pMap = new Map((profs ?? []).map((p: any) => [p.id, p]));
      return (data as any[]).map((r) => ({ ...r, profile: pMap.get(r.user_id) }));
    },
  });

  const accept = async (req: any) => {
    await addMember({ guild_id: guildId, user_id: req.user_id });
    await supabase.from("guild_join_requests").update({ status: "accepted" } as never).eq("id", req.id);
    const { data: g } = await supabase.from("guilds").select("name").eq("id", guildId).maybeSingle();
    await notify({
      user_id: req.user_id,
      type: "friend_accepted" as any,
      title: "Guild request accepted! 🎉",
      body: `You've joined ${(g as any)?.name ?? "the guild"}!`,
      link: `/guilds/${guildId}`,
    });
    toast.success("Member added");
    onChange();
    refetchReq();
  };
  const decline = async (req: any) => {
    await supabase.from("guild_join_requests").update({ status: "declined" } as never).eq("id", req.id);
    const { data: g } = await supabase.from("guilds").select("name").eq("id", guildId).maybeSingle();
    await notify({
      user_id: req.user_id,
      type: "friend_request" as any,
      title: "Guild request declined",
      body: `Your request to join ${(g as any)?.name ?? "the guild"} was declined.`,
      link: `/guilds`,
    });
    refetchReq();
  };

  const setRole = async (m: any, role: "officer" | "member") => {
    await supabase.from("guild_members").update({ role } as never).eq("id", m.id);
    onChange();
    setOpenMenuFor(null);
  };
  const kick = async (m: any) => {
    if (!confirm(`Remove @${m.profile?.username} from the guild?`)) return;
    await removeMember({ guild_id: guildId, user_id: m.user_id });
    const { data: g } = await supabase.from("guilds").select("name").eq("id", guildId).maybeSingle();
    await notify({
      user_id: m.user_id,
      type: "friend_request" as any,
      title: "Removed from guild",
      body: `You were removed from ${(g as any)?.name ?? "the guild"}.`,
      link: "/guilds",
    });
    onChange();
    setOpenMenuFor(null);
  };
  const setNickname = async (m: any, value: string | null) => {
    await supabase.from("guild_members").update({ guild_nickname: value } as never).eq("id", m.id);
    onChange();
    setNicknameFor(null);
  };

  return (
    <div className="space-y-6">
      {(isLeader || isOfficer) && joinType === "request" && (
        <section>
          <h3 className="text-sm font-semibold mb-2">Join Requests ({requests.length})</h3>
          {requests.length === 0 ? (
            <p className="text-xs text-muted-foreground">No pending requests.</p>
          ) : (
            <div className="space-y-2">
              {(requests as any[]).map((r) => (
                <div key={r.id} className="rounded-lg border border-border bg-card/40 p-3 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-secondary overflow-hidden shrink-0">
                    {r.profile?.avatar_url && <img src={r.profile.avatar_url} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">@{r.profile?.username}</div>
                    {r.message && <div className="text-xs text-muted-foreground truncate">{r.message}</div>}
                  </div>
                  <Button size="sm" onClick={() => accept(r)}>Accept</Button>
                  <Button size="sm" variant="outline" onClick={() => decline(r)}>Decline</Button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section>
        <h3 className="text-sm font-semibold mb-2">Members</h3>
        <div className="space-y-1.5">
          {members.map((m, i) => {
            const display = m.guild_nickname || m.profile?.username || "user";
            const canManage = isLeader && m.user_id !== user?.id;
            const canManageOfficer = isOfficer && m.user_id !== user?.id && m.role === "member";
            return (
              <div key={m.id} className="rounded-lg border border-border bg-card/40 p-3 flex items-center gap-3">
                <span className="w-6 text-xs text-muted-foreground tabular-nums">#{i + 1}</span>
                <div className="h-9 w-9 rounded-full bg-secondary overflow-hidden shrink-0">
                  {m.profile?.avatar_url && <img src={m.profile.avatar_url} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold truncate">{display}</span>
                    {m.guild_nickname && <span className="text-[10px] text-muted-foreground">@{m.profile?.username}</span>}
                    {m.role === "leader" && <span className="text-[9px] rounded bg-amber-500/15 text-amber-400 px-1.5 py-0.5 font-bold uppercase"><Crown className="inline h-2.5 w-2.5 mr-0.5" />Leader</span>}
                    {m.role === "officer" && <span className="text-[9px] rounded bg-blue-500/15 text-blue-400 px-1.5 py-0.5 font-bold uppercase">Officer</span>}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Weekly {m.weekly_xp_contributed} XP · Total {m.total_xp_contributed} XP</div>
                </div>
                {(canManage || canManageOfficer) && (
                  <div className="relative">
                    <Button size="sm" variant="ghost" onClick={() => setOpenMenuFor(openMenuFor === m.id ? null : m.id)}>⋯</Button>
                    {openMenuFor === m.id && (
                      <div className="absolute right-0 top-full mt-1 w-48 z-10 rounded-md border border-border bg-popover shadow-lg py-1 text-sm">
                        <button onClick={() => { setNicknameFor({ row: m }); setOpenMenuFor(null); }} className="w-full text-left px-3 py-1.5 hover:bg-secondary">Set Nickname</button>
                        {m.guild_nickname && (
                          <button onClick={() => setNickname(m, null)} className="w-full text-left px-3 py-1.5 hover:bg-secondary">Remove Nickname</button>
                        )}
                        {isLeader && m.role === "member" && <button onClick={() => setRole(m, "officer")} className="w-full text-left px-3 py-1.5 hover:bg-secondary">Promote to Officer</button>}
                        {isLeader && m.role === "officer" && <button onClick={() => setRole(m, "member")} className="w-full text-left px-3 py-1.5 hover:bg-secondary">Demote to Member</button>}
                        {(isLeader || isOfficer) && (
                          <button onClick={() => kick(m)} className="w-full text-left px-3 py-1.5 hover:bg-secondary text-destructive">Kick from Guild</button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {nicknameFor && (
        <NicknameModal
          row={nicknameFor.row}
          onClose={() => setNicknameFor(null)}
          onSave={(val) => setNickname(nicknameFor.row, val)}
        />
      )}
    </div>
  );
}

function NicknameModal({ row, onClose, onSave }: { row: any; onClose: () => void; onSave: (v: string) => void }) {
  const [val, setVal] = useState(row.guild_nickname ?? "");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-xl border border-border bg-card p-5">
        <h3 className="font-bold mb-3">Set @{row.profile?.username}'s nickname</h3>
        <Input value={val} onChange={(e) => setVal(e.target.value.slice(0, 30))} placeholder="Nickname" />
        <div className="text-[10px] text-muted-foreground mt-1">{val.length}/30</div>
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(val.trim())} disabled={!val.trim()}>Save</Button>
        </div>
      </div>
    </div>
  );
}

// ============ CHEST TAB ============
function ChestTab({ guildId, members, isMember, isLeader, isOfficer }: any) {
  const { user } = useAuth();
  const [showDonate, setShowDonate] = useState(false);
  const [distributeFor, setDistributeFor] = useState<any | null>(null);

  const { data: chest = [], refetch } = useQuery({
    queryKey: ["guild-chest", guildId],
    enabled: isMember,
    queryFn: async () => {
      const { data } = await supabase.from("guild_chest").select("*").eq("guild_id", guildId);
      if (!data) return [];
      const cardIds = (data as any[]).map((c) => c.card_id);
      const { data: cards } = await supabase.from("cards").select("*, series(slug, title)").in("id", cardIds);
      const cMap = new Map((cards ?? []).map((c: any) => [c.id, c]));
      return (data as any[]).map((row) => ({ ...row, card: cMap.get(row.card_id) }));
    },
  });

  if (!isMember) {
    return <p className="text-sm text-muted-foreground">Only guild members can view the chest.</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Guild Chest ({chest.length})</h3>
        <Button size="sm" onClick={() => setShowDonate(true)}>Donate Card</Button>
      </div>
      {chest.length === 0 ? (
        <p className="text-sm text-muted-foreground">The chest is empty. Donate a card to get started!</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {(chest as any[]).map((row) => (
            <div key={row.id} className="space-y-1">
              {row.card && <CardDisplay card={row.card} userCard={{ id: row.id, quantity: row.quantity, frame_level: 0 }} size="sm" />}
              {(isLeader || isOfficer) && (
                <Button size="sm" variant="outline" className="w-full text-[10px] h-7" onClick={() => setDistributeFor(row)}>
                  Distribute
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {showDonate && user && (
        <DonateModal
          guildId={guildId}
          userId={user.id}
          onClose={() => setShowDonate(false)}
          onDone={() => { setShowDonate(false); refetch(); }}
        />
      )}
      {distributeFor && (
        <DistributeModal
          chestRow={distributeFor}
          members={members}
          onClose={() => setDistributeFor(null)}
          onDone={() => { setDistributeFor(null); refetch(); }}
        />
      )}
    </div>
  );
}

function DonateModal({ guildId, userId, onClose, onDone }: any) {
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { data: cards = [] } = useQuery({
    queryKey: ["my-cards-for-donate", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_cards")
        .select("*, card:cards(*, series(slug, title))")
        .eq("user_id", userId)
        .gt("quantity", 0);
      return data ?? [];
    },
  });

  const submit = async () => {
    if (!selected) return;
    const row = (cards as any[]).find((c) => c.id === selected);
    if (!row) return;
    setBusy(true);
    try {
      // decrement user_cards
      const newQty = row.quantity - 1;
      if (newQty <= 0) {
        await supabase.from("user_cards").delete().eq("id", row.id);
      } else {
        await supabase.from("user_cards").update({ quantity: newQty } as never).eq("id", row.id);
      }
      // upsert into chest
      const { data: existing } = await supabase
        .from("guild_chest")
        .select("id, quantity")
        .eq("guild_id", guildId)
        .eq("card_id", row.card_id)
        .maybeSingle();
      if (existing) {
        await supabase.from("guild_chest").update({ quantity: (existing as any).quantity + 1 } as never).eq("id", (existing as any).id);
      } else {
        await supabase.from("guild_chest").insert({ guild_id: guildId, card_id: row.card_id, donated_by: userId, quantity: 1 } as never);
      }
      // award guild xp
      await supabase.rpc("award_guild_xp" as any, {
        _guild_id: guildId, _user_id: userId, _amount: 5, _source: "chest_donation", _description: "Donated a card to the chest",
      } as any);
      toast.success("Card donated! +5 Guild XP");
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-xl border border-border bg-card flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-bold">Donate a Card</h3>
          <button onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {cards.length === 0 ? (
            <p className="text-sm text-muted-foreground">You have no cards to donate.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {(cards as any[]).map((row) => (
                <button
                  key={row.id}
                  onClick={() => setSelected(row.id)}
                  className={`text-left rounded-lg p-1 ${selected === row.id ? "ring-2 ring-primary" : ""}`}
                >
                  {row.card && <CardDisplay card={row.card} userCard={{ id: row.id, quantity: row.quantity, frame_level: 0 }} size="sm" />}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="p-4 border-t border-border flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!selected || busy}>{busy ? "Donating…" : "Donate (+5 XP)"}</Button>
        </div>
      </div>
    </div>
  );
}

function DistributeModal({ chestRow, members, onClose, onDone }: any) {
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!selectedUid) return;
    setBusy(true);
    try {
      const newQty = chestRow.quantity - 1;
      if (newQty <= 0) {
        await supabase.from("guild_chest").delete().eq("id", chestRow.id);
      } else {
        await supabase.from("guild_chest").update({ quantity: newQty } as never).eq("id", chestRow.id);
      }
      await grantCardToUser(selectedUid, chestRow.card_id);
      const target = (members as any[]).find((m) => m.user_id === selectedUid);
      await notify({
        user_id: selectedUid,
        type: "card_drop",
        title: "🎴 Card received!",
        body: "A card was distributed to you from the guild chest.",
        link: "/my-cards",
      });
      toast.success(`Distributed to @${target?.profile?.username}`);
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold">Distribute card to…</h3>
          <button onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[400px] overflow-y-auto space-y-1">
          {(members as any[]).map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedUid(m.user_id)}
              className={`w-full flex items-center gap-3 p-2 rounded-md hover:bg-secondary ${selectedUid === m.user_id ? "bg-primary/10" : ""}`}
            >
              <div className="h-8 w-8 rounded-full bg-secondary overflow-hidden">
                {m.profile?.avatar_url && <img src={m.profile.avatar_url} alt="" className="h-full w-full object-cover" />}
              </div>
              <span className="text-sm">@{m.profile?.username}</span>
            </button>
          ))}
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!selectedUid || busy}>{busy ? "Sending…" : "Distribute"}</Button>
        </div>
      </div>
    </div>
  );
}

// ============ WARS TAB ============
function WarsTab({ guildId, guildName, isLeader, activeWar }: any) {
  const { data: history = [] } = useQuery({
    queryKey: ["guild-wars-history", guildId],
    queryFn: async () => {
      const { data } = await supabase
        .from("guild_wars")
        .select("*")
        .or(`guild_a_id.eq.${guildId},guild_b_id.eq.${guildId}`)
        .neq("status", "active")
        .order("ends_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      {activeWar ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Swords className="h-5 w-5 text-destructive" />
            <h3 className="font-bold">Active War</h3>
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-emerald-400"><span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> live</span>
          </div>
          <div className="text-sm">
            <div className="font-semibold">{guildName} vs {activeWar.other?.name}</div>
            <div className="text-xs text-muted-foreground">📚 {activeWar.series?.title}</div>
          </div>
          <div className="mt-3 flex items-center justify-center gap-6 text-2xl font-bold font-mono">
            <span>{activeWar.guild_a_id === guildId ? activeWar.guild_a_score : activeWar.guild_b_score}</span>
            <span className="text-muted-foreground text-base">vs</span>
            <span>{activeWar.guild_a_id === guildId ? activeWar.guild_b_score : activeWar.guild_a_score}</span>
          </div>
          <div className="mt-2 text-center text-xs text-muted-foreground">⏱ {timeRemaining(activeWar.ends_at)}</div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card/40 p-6 text-center">
          <Swords className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No active war.</p>
          {isLeader && (
            <p className="text-xs text-muted-foreground mt-3">Wars are scheduled by admins. Contact an admin to start a war between guilds.</p>
          )}
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold mb-2">War History</h3>
        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground">No past wars.</p>
        ) : (
          <div className="space-y-2">
            {(history as any[]).map((w) => {
              const isA = w.guild_a_id === guildId;
              const won = w.winner_id === guildId;
              return (
                <div key={w.id} className="rounded-lg border border-border bg-card/40 p-3 flex items-center justify-between text-sm">
                  <span>{isA ? w.guild_a_score : w.guild_b_score} vs {isA ? w.guild_b_score : w.guild_a_score}</span>
                  <span className={won ? "text-emerald-400 font-semibold" : "text-destructive"}>{won ? "Victory" : w.winner_id ? "Defeat" : w.status}</span>
                  <span className="text-xs text-muted-foreground">{new Date(w.ends_at).toLocaleDateString()}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ============ RELATIONS TAB ============
function RelationsTab({ guildId, relations, isLeader }: any) {
  const allies = (relations as any[]).filter((r) => r.type === "ally");
  const rivals = (relations as any[]).filter((r) => r.type === "rival");

  const remove = async (id: string) => {
    await supabase.from("guild_relations").delete().eq("id", id);
    location.reload();
  };

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <RelationsSection title="Allies" items={allies} borderCls="border-emerald-500/40" canManage={isLeader} onRemove={remove} guildId={guildId} type="ally" />
      <RelationsSection title="Rivals" items={rivals} borderCls="border-destructive/40" canManage={isLeader} onRemove={remove} guildId={guildId} type="rival" />
    </div>
  );
}

function RelationsSection({ title, items, borderCls, canManage, onRemove, guildId, type }: any) {
  const [showAdd, setShowAdd] = useState(false);
  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">{title} ({items.length})</h3>
        {canManage && <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>Add {title.slice(0, -1)}</Button>}
      </div>
      <div className="space-y-2">
        {items.map((r: any) => (
          <div key={r.id} className={`rounded-lg border ${borderCls} bg-card/40 p-3 flex items-center gap-3`}>
            <div className="h-8 w-8 rounded-full bg-secondary overflow-hidden">
              {r.target?.avatar_url && <img src={r.target.avatar_url} alt="" className="h-full w-full object-cover" />}
            </div>
            <Link to="/guilds/$guildId" params={{ guildId: r.target_guild_id }} className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{r.target?.name}</div>
              <div className="text-[10px] text-muted-foreground">Lv. {r.target?.level} · {r.target?.member_count} members</div>
            </Link>
            {canManage && <button onClick={() => onRemove(r.id)} className="text-xs text-destructive">Remove</button>}
          </div>
        ))}
      </div>
      {showAdd && <AddRelationModal guildId={guildId} type={type} onClose={() => setShowAdd(false)} />}
    </section>
  );
}

function AddRelationModal({ guildId, type, onClose }: any) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  useEffect(() => {
    if (q.length < 2) { setResults([]); return; }
    let cancelled = false;
    supabase.from("guilds").select("id, name, avatar_url, level, member_count").ilike("name", `%${q}%`).neq("id", guildId).limit(8).then(({ data }) => {
      if (!cancelled) setResults(data ?? []);
    });
    return () => { cancelled = true; };
  }, [q, guildId]);

  const add = async (target: any) => {
    const { error } = await supabase.from("guild_relations").insert({ guild_id: guildId, target_guild_id: target.id, type } as never);
    if (error) toast.error(error.message);
    else { toast.success("Added"); location.reload(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold">Add {type}</h3>
          <button onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search guild name…" autoFocus />
        <div className="mt-3 space-y-1 max-h-60 overflow-y-auto">
          {results.map((g) => (
            <button key={g.id} onClick={() => add(g)} className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-secondary">
              <div className="h-8 w-8 rounded-full bg-secondary overflow-hidden">
                {g.avatar_url && <img src={g.avatar_url} alt="" className="h-full w-full object-cover" />}
              </div>
              <span className="text-sm">{g.name}</span>
              <span className="ml-auto text-[10px] text-muted-foreground">Lv. {g.level}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============ ACTIVITY TAB ============
function ActivityTab({ guildId }: { guildId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [limit, setLimit] = useState(30);

  const load = async (lim: number) => {
    const { data } = await supabase
      .from("guild_xp_log")
      .select("*")
      .eq("guild_id", guildId)
      .order("created_at", { ascending: false })
      .limit(lim);
    if (!data) return;
    const ids = Array.from(new Set((data as any[]).map((d) => d.user_id)));
    const { data: profs } = await supabase.from("user_profiles").select("id, username, avatar_url").in("id", ids);
    const pMap = new Map((profs ?? []).map((p: any) => [p.id, p]));
    // also get nicknames
    const { data: gms } = await supabase.from("guild_members").select("user_id, guild_nickname").eq("guild_id", guildId).in("user_id", ids);
    const nMap = new Map((gms ?? []).map((m: any) => [m.user_id, m.guild_nickname]));
    setItems((data as any[]).map((d) => ({ ...d, profile: pMap.get(d.user_id), nickname: nMap.get(d.user_id) })));
  };

  useEffect(() => { load(limit); }, [limit, guildId]);
  useEffect(() => {
    const ch = supabase
      .channel(`guild-xp:${guildId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "guild_xp_log", filter: `guild_id=eq.${guildId}` }, () => load(limit))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [guildId, limit]);

  return (
    <div>
      <h3 className="text-sm font-semibold mb-2">Activity</h3>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">No activity yet.</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((it) => {
            const display = it.nickname || it.profile?.username || "user";
            const ago = timeAgo(it.created_at);
            return (
              <div key={it.id} className="rounded-lg border border-border bg-card/40 p-3 flex items-center gap-3 text-sm">
                <div className="h-8 w-8 rounded-full bg-secondary overflow-hidden shrink-0">
                  {it.profile?.avatar_url && <img src={it.profile.avatar_url} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold">@{display}</span>{" "}
                  <span className="text-muted-foreground">{it.description ?? it.source}</span>
                </div>
                <span className={`text-xs font-bold tabular-nums ${it.xp_amount >= 0 ? "text-primary" : "text-destructive"}`}>
                  {it.xp_amount >= 0 ? "+" : ""}{it.xp_amount} XP
                </span>
                <span className="text-[10px] text-muted-foreground">{ago}</span>
              </div>
            );
          })}
          {items.length === limit && (
            <Button variant="outline" size="sm" className="w-full" onClick={() => setLimit((l) => l + 30)}>Load more</Button>
          )}
        </div>
      )}
    </div>
  );
}

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60000) return "now";
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
  return `${Math.floor(ms / 86400000)}d ago`;
}

// ============ REQUEST MODAL ============
function RequestModal({ guild, userId, onClose }: any) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const { error } = await supabase.from("guild_join_requests").insert({
      guild_id: guild.id, user_id: userId, message: msg.trim() || null,
    } as never);
    if (error) {
      toast.error(error.message);
    } else {
      // notify leader
      const { data: prof } = await supabase.from("user_profiles").select("username").eq("id", userId).maybeSingle();
      await notify({
        user_id: guild.leader_id,
        type: "friend_request" as any,
        title: "New join request ⚔️",
        body: `@${(prof as any)?.username ?? "someone"} wants to join ${guild.name}`,
        link: `/guilds/${guild.id}`,
      });
      toast.success("Request sent");
      onClose();
    }
    setBusy(false);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold">Request to join {guild.name}</h3>
          <button onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <textarea
          value={msg}
          onChange={(e) => setMsg(e.target.value.slice(0, 200))}
          rows={3}
          className="w-full rounded-md border border-input bg-transparent p-2 text-sm"
          placeholder="Optional message…"
        />
        <div className="text-[10px] text-muted-foreground mt-1">{msg.length}/200</div>
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Sending…" : "Send Request"}</Button>
        </div>
      </div>
    </div>
  );
}

// ============ SETTINGS MODAL ============
function SettingsModal({ guild, onClose, onSaved }: { guild: any; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(guild.name);
  const [description, setDescription] = useState(guild.description ?? "");
  const [joinType, setJoinType] = useState<"open" | "request" | "closed">(guild.join_type);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [banner, setBanner] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDissolve, setConfirmDissolve] = useState("");
  const nav = useNavigate();

  const save = async () => {
    setBusy(true);
    try {
      const updates: any = {
        name: name.trim(),
        description: description.trim() || null,
        join_type: joinType,
      };
      if (avatar) {
        const ext = avatar.name.split(".").pop() ?? "jpg";
        const path = `${guild.id}/avatar-${Date.now()}.${ext}`;
        await supabase.storage.from("guild-avatars").upload(path, avatar, { upsert: true, contentType: avatar.type });
        updates.avatar_url = supabase.storage.from("guild-avatars").getPublicUrl(path).data.publicUrl;
      }
      if (banner) {
        const ext = banner.name.split(".").pop() ?? "jpg";
        const path = `${guild.id}/banner-${Date.now()}.${ext}`;
        await supabase.storage.from("guild-banners").upload(path, banner, { upsert: true, contentType: banner.type });
        updates.banner_url = supabase.storage.from("guild-banners").getPublicUrl(path).data.publicUrl;
      }
      const { error } = await supabase.from("guilds").update(updates as never).eq("id", guild.id);
      if (error) throw error;
      toast.success("Saved");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  const dissolve = async () => {
    if (confirmDissolve !== guild.name) return toast.error("Type the guild name to confirm");
    setBusy(true);
    try {
      // reclaim guild card from all members
      if (guild.guild_card_id) {
        const { data: mems } = await supabase.from("guild_members").select("user_id").eq("guild_id", guild.id);
        for (const m of (mems ?? [])) {
          await removeCardFromUser((m as any).user_id, guild.guild_card_id);
        }
      }
      // clear profile guild_id for all members
      const { data: mems } = await supabase.from("guild_members").select("user_id").eq("guild_id", guild.id);
      const ids = (mems ?? []).map((m: any) => m.user_id);
      if (ids.length) await supabase.from("user_profiles").update({ guild_id: null } as never).in("id", ids);
      await supabase.from("guilds").delete().eq("id", guild.id);
      toast.success("Guild dissolved");
      nav({ to: "/guilds" });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold">Guild Settings</h3>
          <button onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value.slice(0, 500))} rows={3} className="w-full rounded-md border border-input bg-transparent p-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Join type</label>
            <div className="mt-1 flex gap-2">
              {(["open", "request", "closed"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setJoinType(t)}
                  className={`flex-1 rounded-md border px-2 py-2 text-xs font-medium capitalize ${joinType === t ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground"}`}
                >{t}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Change avatar</label>
            <input type="file" accept="image/*" onChange={(e) => setAvatar(e.target.files?.[0] ?? null)} className="block w-full text-xs mt-1" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Change banner</label>
            <input type="file" accept="image/*" onChange={(e) => setBanner(e.target.files?.[0] ?? null)} className="block w-full text-xs mt-1" />
          </div>
          <Button onClick={save} disabled={busy} className="w-full">{busy ? "Saving…" : "Save Changes"}</Button>

          <div className="mt-6 pt-4 border-t border-destructive/30">
            <h4 className="font-bold text-destructive mb-2">Danger Zone</h4>
            <p className="text-xs text-muted-foreground mb-2">Dissolving the guild removes everyone and cannot be undone. Type the guild name to confirm.</p>
            <Input value={confirmDissolve} onChange={(e) => setConfirmDissolve(e.target.value)} placeholder={guild.name} />
            <Button variant="outline" className="mt-2 w-full text-destructive border-destructive/40" onClick={dissolve} disabled={busy || confirmDissolve !== guild.name}>
              Dissolve Guild
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ ANNOUNCEMENT MODAL ============
function AnnouncementModal({ isLeader, onClose, onPost }: { isLeader: boolean; onClose: () => void; onPost: (content: string, pinned: boolean) => void }) {
  const [content, setContent] = useState("");
  const [pinned, setPinned] = useState(false);
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">📢 Post Announcement</h3>
          <button onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Share an update with the guild…"
          className="w-full min-h-[120px] rounded-md border border-border bg-background p-2 text-sm"
          maxLength={500}
        />
        <div className="text-[10px] text-muted-foreground text-right mt-1">{content.length}/500</div>
        {isLeader && (
          <label className="flex items-center gap-2 mt-2 text-sm">
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
            📌 Pin this announcement
          </label>
        )}
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onPost(content, pinned)} disabled={!content.trim()}>Post</Button>
        </div>
      </div>
    </div>
  );
}
