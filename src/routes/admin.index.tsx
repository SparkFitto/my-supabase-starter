import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Users, Languages, Flag, FileText, Megaphone } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: AdminOverview,
});

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function AdminOverview() {
  const { data: stats } = useQuery({
    queryKey: ["admin-overview-stats"],
    queryFn: async () => {
      const [series, users, chapters, glossary, reports, updates] = await Promise.all([
        supabase.from("series").select("id", { count: "exact", head: true }),
        supabase.from("user_profiles").select("id", { count: "exact", head: true }),
        supabase.from("chapters").select("id", { count: "exact", head: true }),
        supabase.from("series_glossary").select("id", { count: "exact", head: true }).eq("approved", false),
        supabase.from("reports").select("id", { count: "exact", head: true }).eq("resolved", false),
        supabase.from("site_updates").select("id", { count: "exact", head: true }),
      ]);
      return {
        series: series.count ?? 0,
        users: users.count ?? 0,
        chapters: chapters.count ?? 0,
        glossary: glossary.count ?? 0,
        reports: reports.count ?? 0,
        updates: updates.count ?? 0,
      };
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Overview</h1>
        <p className="text-sm text-muted-foreground">High-level stats across the platform.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Series" value={stats?.series ?? "—"} icon={BookOpen} />
        <StatCard label="Users" value={stats?.users ?? "—"} icon={Users} />
        <StatCard label="Chapters" value={stats?.chapters ?? "—"} icon={FileText} />
        <StatCard label="Pending glossary" value={stats?.glossary ?? "—"} icon={Languages} />
        <StatCard label="Open reports" value={stats?.reports ?? "—"} icon={Flag} />
        <StatCard label="Updates" value={stats?.updates ?? "—"} icon={Megaphone} />
      </div>
    </div>
  );
}
