import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, Ban, ShieldCheck, Shield } from "lucide-react";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsers,
});

function AdminUsers() {
  const [q, setQ] = useState("");

  const { data: users, refetch } = useQuery({
    queryKey: ["admin-users-list", q],
    queryFn: async () => {
      let query = supabase
        .from("user_profiles")
        .select("id,username,avatar_url,plan,banned_at,created_at,chapters_translated_total")
        .order("created_at", { ascending: false })
        .limit(100);
      if (q.trim()) query = query.ilike("username", `%${q.trim()}%`);
      const { data } = await query;
      return data ?? [];
    },
  });

  const { data: roles } = useQuery({
    queryKey: ["admin-users-roles"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("user_id,role");
      const map: Record<string, string[]> = {};
      data?.forEach((r) => {
        map[r.user_id] = [...(map[r.user_id] ?? []), r.role];
      });
      return map;
    },
  });

  const toggleBan = async (id: string, banned: boolean) => {
    const { error } = await supabase
      .from("user_profiles")
      .update({ banned_at: banned ? null : new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(banned ? "User unbanned" : "User banned"); refetch(); }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Users</h1>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by username…"
          className="pl-9"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        {users?.map((u) => {
          const userRoles = roles?.[u.id] ?? [];
          const isAdmin = userRoles.includes("admin");
          const banned = !!u.banned_at;
          return (
            <div
              key={u.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
            >
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
                {u.avatar_url ? (
                  <img src={u.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">{u.username ?? "—"}</p>
                  {isAdmin && (
                    <Badge variant="default" className="gap-1 text-[10px]">
                      <ShieldCheck className="h-3 w-3" /> admin
                    </Badge>
                  )}
                  {banned && <Badge variant="destructive" className="text-[10px]">banned</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {u.plan} · {u.chapters_translated_total} chapters translated
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={banned ? "outline" : "destructive"}
                  onClick={() => toggleBan(u.id, banned)}
                >
                  {banned ? <Shield className="mr-1 h-3 w-3" /> : <Ban className="mr-1 h-3 w-3" />}
                  {banned ? "Unban" : "Ban"}
                </Button>
              </div>
            </div>
          );
        })}
        {!users?.length && (
          <p className="py-8 text-center text-sm text-muted-foreground">No users found.</p>
        )}
      </div>
    </div>
  );
}
