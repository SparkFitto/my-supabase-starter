import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type BookmarkStatus =
  | "reading"
  | "completed"
  | "on_hold"
  | "dropped"
  | "plan_to_read";

export const BOOKMARK_PILL: Record<
  BookmarkStatus,
  { label: string; classes: string }
> = {
  reading: { label: "Reading", classes: "bg-primary text-primary-foreground" },
  completed: { label: "Completed", classes: "bg-success text-background" },
  on_hold: { label: "On hold", classes: "bg-warning text-background" },
  dropped: { label: "Dropped", classes: "bg-destructive text-destructive-foreground" },
  plan_to_read: { label: "Plan", classes: "bg-purple-accent text-background" },
};

/** Fetch the current user's bookmark for every series, keyed by series_id. */
export function useUserBookmarks() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["user-bookmarks-map", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("reading_lists")
        .select("series_id, status")
        .eq("user_id", user!.id);
      const map: Record<string, BookmarkStatus> = {};
      for (const r of data ?? []) {
        map[r.series_id] = r.status as BookmarkStatus;
      }
      return map;
    },
  });
}
