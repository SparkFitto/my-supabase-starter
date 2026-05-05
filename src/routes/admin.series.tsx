import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/series")({
  component: AdminSeries,
});

function AdminSeries() {
  const [q, setQ] = useState("");
  const { data: series, refetch } = useQuery({
    queryKey: ["admin-series-list", q],
    queryFn: async () => {
      let query = supabase
        .from("series")
        .select("id,title,slug,type,status,dmca_struck,follow_count,cover_url,tier")
        .order("created_at", { ascending: false })
        .limit(100);
      if (q.trim()) query = query.ilike("title", `%${q.trim()}%`);
      const { data } = await query;
      return data ?? [];
    },
  });

  const toggleDmca = async (id: string, current: boolean) => {
    const { error } = await supabase
      .from("series")
      .update({ dmca_struck: !current })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(!current ? "Marked as DMCA struck" : "DMCA strike removed");
      refetch();
    }
  };

  const setTier = async (id: string, tier: number) => {
    const { error } = await supabase.from("series").update({ tier } as never).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Tier updated"); refetch(); }
  };

  const remove = async (id: string, title: string) => {
    if (!confirm(`Delete series "${title}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("series").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); refetch(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Series</h1>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by title…"
          className="pl-9"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        {series?.map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
          >
            <div className="h-14 w-10 shrink-0 overflow-hidden rounded bg-muted">
              {s.cover_url ? (
                <img src={s.cover_url} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{s.title}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-[10px]">{s.type}</Badge>
                <Badge variant="outline" className="text-[10px]">{s.status}</Badge>
                <span>· {s.follow_count} followers</span>
                {s.dmca_struck && (
                  <Badge variant="destructive" className="text-[10px]">DMCA</Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <select
                className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                value={(s as any).tier ?? 1}
                onChange={(e) => setTier(s.id, Number(e.target.value))}
              >
                <option value={1}>Standard</option>
                <option value={2}>Popular</option>
                <option value={3}>Ultra</option>
              </select>
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="hidden sm:inline">DMCA</span>
                <Switch
                  checked={!!s.dmca_struck}
                  onCheckedChange={() => toggleDmca(s.id, !!s.dmca_struck)}
                />
              </label>
              <Button
                size="sm"
                variant="outline"
                onClick={() => remove(s.id, s.title)}
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
        {!series?.length && (
          <p className="py-8 text-center text-sm text-muted-foreground">No series found.</p>
        )}
      </div>
    </div>
  );
}
