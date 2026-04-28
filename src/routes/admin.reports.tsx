import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/admin/reports")({
  component: AdminReports,
});

function AdminReports() {
  const [filter, setFilter] = useState<"open" | "all">("open");

  const { data: reports, refetch } = useQuery({
    queryKey: ["admin-reports", filter],
    queryFn: async () => {
      let q = supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (filter === "open") q = q.eq("resolved", false);
      const { data } = await q;
      return data ?? [];
    },
  });

  const resolve = async (id: string) => {
    const { error } = await supabase.from("reports").update({ resolved: true }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Marked resolved"); refetch(); }
  };

  const deleteContent = async (r: { comment_type: string; comment_id: string; id: string }) => {
    if (!confirm("Delete the reported content?")) return;
    const table =
      r.comment_type === "series"
        ? "series_comments"
        : r.comment_type === "profile"
          ? "profile_comments"
          : null;
    if (!table) {
      toast.error("Unknown content type");
      return;
    }
    const { error } = await supabase.from(table).delete().eq("id", r.comment_id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("reports").update({ resolved: true }).eq("id", r.id);
    toast.success("Content deleted");
    refetch();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reports</h1>
        <div className="flex rounded-md border border-border p-0.5">
          <button
            onClick={() => setFilter("open")}
            className={`px-3 py-1 text-xs ${filter === "open" ? "bg-primary text-primary-foreground rounded" : "text-muted-foreground"}`}
          >
            Open
          </button>
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1 text-xs ${filter === "all" ? "bg-primary text-primary-foreground rounded" : "text-muted-foreground"}`}
          >
            All
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {reports?.map((r) => (
          <div key={r.id} className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{r.comment_type}</Badge>
                  {r.resolved ? (
                    <Badge variant="secondary" className="text-[10px]">resolved</Badge>
                  ) : (
                    <Badge variant="destructive" className="text-[10px]">open</Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="mt-2 text-sm">{r.reason || <em className="text-muted-foreground">No reason given</em>}</p>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">id: {r.comment_id}</p>
              </div>
            </div>
            {!r.resolved && (
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => resolve(r.id)}>Dismiss</Button>
                <Button size="sm" variant="destructive" onClick={() => deleteContent(r)}>
                  Delete content
                </Button>
              </div>
            )}
          </div>
        ))}
        {!reports?.length && (
          <p className="py-8 text-center text-sm text-muted-foreground">No reports.</p>
        )}
      </div>
    </div>
  );
}
