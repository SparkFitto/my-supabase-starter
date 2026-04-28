import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Settings as SettingsIcon } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileShell } from "@/components/profile/ProfileShell";
import { ProfileTab } from "@/components/profile/ProfileTab";
import { BookmarksList } from "@/components/profile/BookmarksList";
import { SocialTab } from "@/components/profile/SocialTab";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Your profile — RAWL" }, { name: "robots", content: "noindex" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState("profile");

  useEffect(() => {
    if (!loading && !user) nav({ to: "/signin" });
  }, [loading, user, nav]);

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <Skeleton className="h-[220px] w-full" />
      </div>
    );
  }

  const rightActions = (
    <Button asChild size="sm" variant="outline">
      <Link to="/settings"><SettingsIcon className="h-4 w-4 mr-1" />Settings</Link>
    </Button>
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-5xl pb-12">
        <ProfileShell
          profile={profile as any}
          isOwn
          rightActions={rightActions}
          activeTab={tab}
          onTabChange={setTab}
          onProfileUpdated={() => refreshProfile()}
        >
          {tab === "profile" && (
            <ProfileTab
              profileId={profile.id}
              username={profile.username ?? ""}
              isOwn
              bio={profile.bio}
              historyIsPrivate={!!profile.history_is_private}
              friendsArePrivate={!!profile.friends_are_private}
              readingIsPrivate={!!profile.reading_is_private}
              onBioSaved={() => refreshProfile()}
            />
          )}
          {tab === "bookmarks" && (
            <BookmarksList userId={profile.id} isOwn readingIsPrivate={!!profile.reading_is_private} />
          )}
          {tab === "social" && (
            <SocialTab
              profileId={profile.id}
              username={profile.username ?? ""}
              isOwn
              viewerId={user!.id}
              friendsArePrivate={!!profile.friends_are_private}
            />
          )}
        </ProfileShell>
      </main>
    </div>
  );
}
