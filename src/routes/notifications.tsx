import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Check, Trash2, MessageSquare, UserPlus, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/constants";

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "Notifications — RAWL" }] }),
  component: NotificationsPage,
});

type Notif = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
};

const ICONS: Record<string, any> = {
  message: MessageSquare,
  friend_request: UserPlus,
  chapter: BookOpen,
};

function NotificationsPage() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      setItems((data ?? []) as Notif[]);
    };
    load();

    const channel = supabase
      .channel(`notif:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  if (loading) return null;
  if (!user) throw redirect({ to: "/signin" });

  const markAll = async () => {
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
  };
  const markOne = async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
  };
  const removeOne = async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
  };
  const clearAll = async () => {
    if (!confirm("Delete all notifications?")) return;
    await supabase.from("notifications").delete().eq("user_id", user.id);
  };

  const unread = items.filter((i) => !i.read).length;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6" />
            Notifications
            {unread > 0 && <span className="text-xs font-mono bg-destructive text-destructive-foreground px-2 py-0.5 rounded-full">{unread}</span>}
          </h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={markAll} disabled={unread === 0}>
              <Check className="h-4 w-4 mr-1" />Mark all read
            </Button>
            <Button variant="ghost" size="sm" onClick={clearAll} disabled={items.length === 0}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-16">
            <Bell className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">You're all caught up.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((n) => {
              const Icon = ICONS[n.type] ?? Bell;
              const inner = (
                <div className={`flex items-start gap-3 rounded-lg border border-border p-3 ${n.read ? "bg-card" : "bg-primary/5 border-primary/30"}`}>
                  <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{n.title}</div>
                    {n.body && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</div>}
                    <div className="text-[10px] text-muted-foreground mt-1">{timeAgo(n.created_at)}</div>
                  </div>
                  <button onClick={(e) => { e.preventDefault(); removeOne(n.id); }} className="text-muted-foreground hover:text-destructive p-1">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
              if (n.link) {
                return (
                  <Link key={n.id} to={n.link as any} onClick={() => markOne(n.id)} className="block">
                    {inner}
                  </Link>
                );
              }
              return <div key={n.id} onClick={() => markOne(n.id)}>{inner}</div>;
            })}
          </div>
        )}
      </main>
    </div>
  );
}
