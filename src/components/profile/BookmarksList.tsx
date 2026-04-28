import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Settings as SettingsIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const STATUSES = [
  { value: "all", label: "All", color: "bg-secondary text-foreground" },
  { value: "reading", label: "Reading", color: "bg-primary text-primary-foreground" },
  { value: "plan_to_read", label: "Plan to Read", color: "bg-purple-accent text-background" },
  { value: "completed", label: "Completed", color: "bg-success text-background" },
  { value: "on_hold", label: "On Hold", color: "bg-warning text-background" },
  { value: "dropped", label: "Dropped", color: "bg-destructive text-destructive-foreground" },
];

export function BookmarksList({
  userId,
  isOwn,
  readingIsPrivate,
}: {
  userId: string;
  isOwn: boolean;
  readingIsPrivate: boolean;
}) {
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"updated" | "title">("updated");
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const { data: items = [], refetch } = useQuery({
    queryKey: ["bookmarks-list", userId, status, sort],
    enabled: isOwn || !readingIsPrivate,
    queryFn: async () => {
      let q = supabase
        .from("reading_lists")
        .select("id, status, current_chapter, is_private, updated_at, series:series(slug, title, cover_url)")
        .eq("user_id", userId);
      if (!isOwn) q = q.eq("is_private", false);
      if (status !== "all") q = q.eq("status", status);
      q = sort === "title"
        ? q.order("added_at", { ascending: true })
        : q.order("updated_at", { ascending: false });
      const { data } = await q.limit(200);
      return data ?? [];
    },
  });

  if (!isOwn && readingIsPrivate) {
    return <p className="text-sm text-muted-foreground">This user's reading list is private.</p>;
  }

  const filtered = items.filter((i: any) =>
    !search.trim() || (i.series?.title ?? "").toLowerCase().includes(search.toLowerCase()),
  );
  if (sort === "title") {
    filtered.sort((a: any, b: any) => (a.series?.title ?? "").localeCompare(b.series?.title ?? ""));
  }

  const updateStatus = async (id: string, newStatus: string) => {
    await supabase.from("reading_lists").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", id);
    setOpenMenu(null);
    toast.success("Updated");
    refetch();
  };

  const remove = async (id: string) => {
    await supabase.from("reading_lists").delete().eq("id", id);
    setOpenMenu(null);
    toast.success("Removed");
    refetch();
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        {STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => setStatus(s.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition ${
              status === s.value ? s.color : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title…"
            className="pl-8"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as "updated" | "title")}
          className="rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="updated">Recently updated</option>
          <option value="title">Title A–Z</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No bookmarks here.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card/40 overflow-hidden">
          {filtered.map((b: any) => {
            const statusMeta = STATUSES.find((s) => s.value === b.status);
            return (
              <li key={b.id} className="flex items-center gap-3 p-3 hover:bg-secondary/30 transition relative">
                <Link to="/series/$slug" params={{ slug: b.series?.slug ?? "" }} className="shrink-0">
                  <div className="h-[70px] w-[52px] rounded-md overflow-hidden bg-secondary border border-border">
                    {b.series?.cover_url && (
                      <img src={b.series.cover_url} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                </Link>
                <div className="flex-1 min-w-0">
                  <Link
                    to="/series/$slug"
                    params={{ slug: b.series?.slug ?? "" }}
                    className="text-sm font-semibold hover:text-primary line-clamp-1"
                  >
                    {b.series?.title ?? "Unknown"}
                  </Link>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {b.current_chapter ? `Read up to Ch. ${b.current_chapter}` : "Not started"}
                  </p>
                  <span
                    className={`inline-block mt-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${statusMeta?.color ?? "bg-secondary"}`}
                  >
                    {statusMeta?.label ?? b.status}
                  </span>
                </div>
                {isOwn && (
                  <div className="relative">
                    <button
                      onClick={() => setOpenMenu(openMenu === b.id ? null : b.id)}
                      className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary"
                      aria-label="Manage"
                    >
                      <SettingsIcon className="h-4 w-4" />
                    </button>
                    {openMenu === b.id && (
                      <div className="absolute right-0 top-full mt-1 w-44 rounded-md border border-border bg-popover p-1 shadow-lg z-10">
                        <p className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">Change status</p>
                        {STATUSES.filter((s) => s.value !== "all").map((s) => (
                          <button
                            key={s.value}
                            onClick={() => updateStatus(b.id, s.value)}
                            className={`block w-full text-left rounded px-2 py-1 text-xs hover:bg-secondary ${b.status === s.value ? "font-semibold" : ""}`}
                          >
                            {s.label}
                          </button>
                        ))}
                        <div className="my-1 border-t border-border" />
                        <button onClick={() => remove(b.id)} className="block w-full text-left rounded px-2 py-1 text-xs text-destructive hover:bg-secondary">
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
