import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  BookOpen,
  Users as UsersIcon,
  Languages,
  Megaphone,
  Flag,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function AdminShell() {
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setIsAdmin(false);
      return;
    }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user, loading]);

  const { data: counts } = useQuery({
    queryKey: ["admin-badge-counts"],
    enabled: isAdmin === true,
    queryFn: async () => {
      const [glossary, reports, cards, suggestions] = await Promise.all([
        supabase.from("series_glossary").select("id", { count: "exact", head: true }).eq("approved", false),
        supabase.from("reports").select("id", { count: "exact", head: true }).eq("resolved", false),
        supabase.from("cards").select("id", { count: "exact", head: true }).eq("is_approved", false),
        supabase.from("card_image_suggestions").select("id", { count: "exact", head: true }),
      ]);
      return {
        glossary: glossary.count ?? 0,
        reports: reports.count ?? 0,
        cards: (cards.count ?? 0) + (suggestions.count ?? 0),
      };
    },
    refetchInterval: 30000,
  });

  if (loading || isAdmin === null) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="p-8 text-center text-muted-foreground">Loading…</div>
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <h1 className="text-2xl font-bold">Admins only</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You need an admin role to access this page.
          </p>
        </div>
      </div>
    );
  }

  const links = [
    { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
    { to: "/admin/series", label: "Series", icon: BookOpen },
    { to: "/admin/cards", label: "Cards", icon: Sparkles, badge: counts?.cards },
    { to: "/admin/users", label: "Users", icon: UsersIcon },
    { to: "/admin/glossary", label: "Glossary", icon: Languages, badge: counts?.glossary },
    { to: "/admin/updates", label: "Updates", icon: Megaphone },
    { to: "/admin/reports", label: "Reports", icon: Flag, badge: counts?.reports },
  ];

  const isActive = (to: string, exact?: boolean) =>
    exact ? path === to : path === to || path.startsWith(to + "/");

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        <aside className="hidden w-56 shrink-0 md:block">
          <nav className="sticky top-20 space-y-1">
            {links.map((l) => {
              const Icon = l.icon;
              const active = isActive(l.to, l.exact);
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {l.label}
                  </span>
                  {l.badge ? (
                    <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground">
                      {l.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Mobile pill nav */}
        <div className="md:hidden fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full border border-border bg-card/95 p-1 shadow-lg backdrop-blur">
          <div className="flex items-center gap-1">
            {links.map((l) => {
              const Icon = l.icon;
              const active = isActive(l.to, l.exact);
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  className={cn(
                    "relative rounded-full p-2",
                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  )}
                  aria-label={l.label}
                >
                  <Icon className="h-4 w-4" />
                  {l.badge ? (
                    <span className="absolute -right-0.5 -top-0.5 rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                      {l.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>

        <main className="min-w-0 flex-1 pb-24 md:pb-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
