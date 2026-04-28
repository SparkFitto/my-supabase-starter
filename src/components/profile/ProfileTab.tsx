import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SectionCard, ChaptersReadBar, EditableBio } from "./ProfileShell";
import { timeAgo } from "@/lib/constants";

export function ProfileTab({
  profileId,
  username,
  isOwn,
  bio,
  historyIsPrivate,
  friendsArePrivate,
  readingIsPrivate,
  onBioSaved,
}: {
  profileId: string;
  username: string;
  isOwn: boolean;
  bio: string | null | undefined;
  historyIsPrivate: boolean;
  friendsArePrivate: boolean;
  readingIsPrivate: boolean;
  onBioSaved?: () => void;
}) {
  // chapters read count
  const { data: chaptersRead = 0 } = useQuery({
    queryKey: ["chapters-read-count", profileId],
    queryFn: async () => {
      const { count } = await supabase
        .from("reading_history")
        .select("*", { count: "exact", head: true })
        .eq("user_id", profileId);
      return count ?? 0;
    },
  });

  // recent history (5)
  const { data: history = [] } = useQuery({
    queryKey: ["profile-history-recent", profileId],
    queryFn: async () => {
      const { data } = await supabase
        .from("reading_history")
        .select("id, chapter_number, read_at, series:series(slug, title)")
        .eq("user_id", profileId)
        .order("read_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  // bookmarks preview
  const { data: bookmarks = [] } = useQuery({
    queryKey: ["profile-bookmarks-preview", profileId],
    queryFn: async () => {
      const q = supabase
        .from("reading_lists")
        .select("id, status, current_chapter, is_private, updated_at, series:series(slug, title, cover_url)")
        .eq("user_id", profileId)
        .eq("status", "reading")
        .order("updated_at", { ascending: false })
        .limit(3);
      const { data } = isOwn ? await q : await q.eq("is_private", false);
      return data ?? [];
    },
  });

  // friends preview (6 most recent accepted)
  const { data: friends = [] } = useQuery({
    queryKey: ["profile-friends-preview", profileId],
    queryFn: async () => {
      const { data } = await supabase
        .from("friendships")
        .select("requester_id, addressee_id, accepted_at")
        .eq("status", "accepted")
        .or(`requester_id.eq.${profileId},addressee_id.eq.${profileId}`)
        .order("accepted_at", { ascending: false, nullsFirst: false })
        .limit(6);
      const ids = (data ?? []).map((f: any) =>
        f.requester_id === profileId ? f.addressee_id : f.requester_id,
      );
      if (!ids.length) return [];
      const { data: profs } = await supabase
        .from("user_profiles")
        .select("id, username, avatar_url")
        .in("id", ids);
      return profs ?? [];
    },
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[55fr_45fr]">
      <div className="space-y-4">
        <SectionCard
          title="Chapters Read"
          more={{ label: "More details", to: isOwn ? "/history" : `/profile/${username}` }}
        >
          <ChaptersReadBar count={chaptersRead} />
        </SectionCard>

        <SectionCard title="About me">
          <EditableBio bio={bio} isOwn={isOwn} userId={profileId} onSaved={onBioSaved} />
        </SectionCard>

        <SectionCard
          title="History"
          more={{ label: "More", to: isOwn ? "/history" : `/profile/${username}` }}
        >
          {!isOwn && historyIsPrivate ? (
            <p className="text-sm text-muted-foreground">History is private</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reading history yet.</p>
          ) : (
            <ul className="space-y-3">
              {history.map((h: any) => (
                <li key={h.id} className="flex items-start gap-3">
                  <span className="mt-0.5 h-7 w-7 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
                    <BookOpen className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="text-[11px] text-muted-foreground">{new Date(h.read_at).toLocaleDateString()}</p>
                    <p className="truncate">
                      Read Ch. {h.chapter_number ?? "?"} of{" "}
                      {h.series ? (
                        <Link to="/series/$slug" params={{ slug: h.series.slug }} className="text-primary hover:underline">
                          {h.series.title}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">unknown series</span>
                      )}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="space-y-4">
        <SectionCard
          title="Bookmarks"
          more={{ label: "More", to: isOwn ? "/bookmarks" : `/profile/${username}` }}
        >
          {!isOwn && readingIsPrivate ? (
            <p className="text-sm text-muted-foreground">Reading list is private</p>
          ) : bookmarks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing added yet</p>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {bookmarks.map((b: any) => (
                <Link
                  key={b.id}
                  to="/series/$slug"
                  params={{ slug: b.series?.slug ?? "" }}
                  className="group block"
                >
                  <div className="aspect-[3/4] w-full rounded-md overflow-hidden bg-secondary border border-border group-hover:border-primary/50">
                    {b.series?.cover_url && (
                      <img src={b.series.cover_url} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <p className="mt-1.5 text-xs font-medium leading-tight line-clamp-2 group-hover:text-primary">
                    {b.series?.title ?? "Unknown"}
                  </p>
                  {b.current_chapter && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">Ch. {b.current_chapter}</p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title={`Friends${friends.length ? ` (${friends.length})` : ""}`}
          more={{ label: "More", to: isOwn ? "/friends" : `/profile/${username}` }}
        >
          {!isOwn && friendsArePrivate ? (
            <p className="text-sm text-muted-foreground">Friends list is private</p>
          ) : friends.length === 0 ? (
            <p className="text-sm text-muted-foreground">No friends yet</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {friends.map((f: any) => (
                <Link
                  key={f.id}
                  to="/profile/$username"
                  params={{ username: f.username ?? "" }}
                  title={`@${f.username}`}
                  className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold overflow-hidden hover:ring-2 hover:ring-primary"
                >
                  {f.avatar_url ? (
                    <img src={f.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (f.username ?? "?").slice(0, 2).toUpperCase()
                  )}
                </Link>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
