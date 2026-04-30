import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { UserPlus, UserCheck, UserX, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { ProfileShell } from "@/components/profile/ProfileShell";
import { ProfileTab } from "@/components/profile/ProfileTab";
import { BookmarksList } from "@/components/profile/BookmarksList";
import { SocialTab } from "@/components/profile/SocialTab";
import { ShowcaseSection } from "@/components/profile/ShowcaseSection";

export const Route = createFileRoute("/profile/$username")({
  head: ({ params }) => ({ meta: [{ title: `@${params.username} — RAWL` }] }),
  component: PublicProfilePage,
});

function PublicProfilePage() {
  const { username } = Route.useParams();
  const { user } = useAuth();
  const [tab, setTab] = useState("profile");

  const { data: profile, isLoading, refetch } = useQuery({
    queryKey: ["public-profile", username],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("id, username, avatar_url, banner_url, bio, plan, last_seen, history_is_private, friends_are_private, reading_is_private")
        .ilike("username", username)
        .maybeSingle();
      return data;
    },
  });

  const profileId = profile?.id;
  const isOwn = !!user && user.id === profileId;

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

  const sendRequest = async () => {
    if (!user || !profileId) return;
    const { error } = await supabase.from("friendships").insert({
      requester_id: user.id, addressee_id: profileId, status: "pending",
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Request sent");
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <Skeleton className="h-[220px] w-full" />
        <div className="px-6 py-4 space-y-3"><Skeleton className="h-20 w-full" /></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="text-center py-20">
          <h1 className="text-xl font-semibold">User not found</h1>
          <p className="text-sm text-muted-foreground mt-2">No user named @{username}.</p>
          <Link to="/" className="text-primary hover:underline text-sm mt-4 inline-block">← Back home</Link>
        </div>
      </div>
    );
  }

  const rightActions = !isOwn && user ? (
    <div className="flex gap-2 flex-wrap">
      {!friendship && (
        <Button size="sm" onClick={sendRequest}><UserPlus className="h-4 w-4 mr-1" />Add friend</Button>
      )}
      {friendship?.status === "pending" && friendship.requester_id === user.id && (
        <Button size="sm" variant="outline" disabled><UserCheck className="h-4 w-4 mr-1" />Pending</Button>
      )}
      {friendship?.status === "pending" && friendship.requester_id !== user.id && (
        <Button size="sm" onClick={acceptRequest}><UserCheck className="h-4 w-4 mr-1" />Accept</Button>
      )}
      {friendship?.status === "accepted" && (
        <Button size="sm" variant="outline" onClick={removeFriend}><UserX className="h-4 w-4 mr-1" />Friends</Button>
      )}
      <Button size="sm" variant="secondary" onClick={startMessage}><MessageSquare className="h-4 w-4 mr-1" />Message</Button>
    </div>
  ) : null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-5xl pb-12">
        <ProfileShell
          profile={profile as any}
          isOwn={isOwn}
          rightActions={rightActions}
          activeTab={tab}
          onTabChange={setTab}
          onProfileUpdated={() => refetch()}
        >
          {tab === "profile" && (
            <div className="space-y-6">
              <ProfileTab
                profileId={profile.id}
                username={profile.username ?? ""}
                isOwn={isOwn}
                bio={profile.bio}
                historyIsPrivate={!!profile.history_is_private}
                friendsArePrivate={!!profile.friends_are_private}
                readingIsPrivate={!!profile.reading_is_private}
                onBioSaved={() => refetch()}
              />
              <ShowcaseSection userId={profile.id} isOwn={isOwn} />
            </div>
          )}
          {tab === "bookmarks" && (
            <BookmarksList
              userId={profile.id}
              isOwn={isOwn}
              readingIsPrivate={!!profile.reading_is_private}
            />
          )}
          {tab === "social" && (
            <SocialTab
              profileId={profile.id}
              username={profile.username ?? ""}
              isOwn={isOwn}
              viewerId={user?.id ?? null}
              friendsArePrivate={!!profile.friends_are_private}
            />
          )}
        </ProfileShell>
      </main>
    </div>
  );
}
