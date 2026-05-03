import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, Ban, ShieldCheck, Shield, Coins } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsers,
});

function AdminUsers() {
  const [q, setQ] = useState("");
  const [grantUser, setGrantUser] = useState<{ id: string; username: string } | null>(null);
  const [grantAmount, setGrantAmount] = useState("100");
  const [grantReason, setGrantReason] = useState("");

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

  const grantInk = async () => {
    if (!grantUser) return;
    const amt = Number(grantAmount);
    if (!amt || amt <= 0 || amt > 100000) {
      toast.error("Amount must be between 1 and 100000");
      return;
    }
    const { data: cur } = await supabase
      .from("user_profiles")
      .select("ink_balance")
      .eq("id", grantUser.id)
      .maybeSingle();
    const newBal = ((cur as any)?.ink_balance ?? 0) + amt;
    const { error } = await supabase
      .from("user_profiles")
      .update({ ink_balance: newBal } as never)
      .eq("id", grantUser.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("daily_ink_log").insert({
      user_id: grantUser.id,
      source: `admin_grant${grantReason ? `:${grantReason}` : ""}`,
      amount: amt,
    } as never);
    toast.success(`Granted ${amt} Ink to @${grantUser.username}`);
    setGrantUser(null);
    setGrantAmount("100");
    setGrantReason("");
    refetch();
  };

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
                  variant="outline"
                  onClick={() => setGrantUser({ id: u.id, username: u.username ?? "user" })}
                >
                  <Coins className="mr-1 h-3 w-3" /> Grant Ink
                </Button>
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

      <Dialog open={!!grantUser} onOpenChange={(o) => !o && setGrantUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant Ink to @{grantUser?.username}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                min={1}
                max={100000}
                value={grantAmount}
                onChange={(e) => setGrantAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>Reason (optional)</Label>
              <Input value={grantReason} onChange={(e) => setGrantReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={grantInk}>Grant</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
