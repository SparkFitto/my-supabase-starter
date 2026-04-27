import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/profile/$username")({
  head: ({ params }) => ({ meta: [{ title: `@${params.username} — RAWL` }] }),
  component: PublicProfilePage,
});

function PublicProfilePage() {
  const { username } = Route.useParams();
  const { data: profile, isLoading } = useQuery({
    queryKey: ["public-profile", username],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("id, username, avatar_url, bio, chapters_translated_total, login_streak, last_seen, plan")
        .ilike("username", username)
        .maybeSingle();
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-6">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        ) : !profile ? (
          <div className="text-center py-20">
            <h1 className="text-xl font-semibold">User not found</h1>
            <p className="text-sm text-muted-foreground mt-2">No user named @{username}.</p>
            <Link to="/" className="text-primary hover:underline text-sm mt-4 inline-block">← Back home</Link>
          </div>
        ) : (
          <>
            <div className="rounded-xl bg-gradient-to-br from-primary/30 to-purple-accent/20 p-6 flex flex-col items-center text-center border border-border">
              <div className="h-20 w-20 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold overflow-hidden ring-4 ring-background">
                {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : (profile.username ?? "?").slice(0, 2).toUpperCase()}
              </div>
              <h1 className="mt-3 text-xl font-bold">@{profile.username}</h1>
              <span className="text-[10px] uppercase tracking-wide text-primary font-bold mt-0.5">{profile.plan}</span>
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
                <div className="text-lg font-bold">—</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Friends</div>
              </div>
            </div>

            {profile.bio && (
              <div className="mt-4 rounded-lg bg-card border border-border p-4 text-sm">{profile.bio}</div>
            )}

            <p className="mt-6 text-center text-xs text-muted-foreground">
              Wall, friends, messages and more coming in the next update.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
