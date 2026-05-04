import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Menu,
  X,
  Bell,
  MessageSquare,
  Users,
  Heart,
  Bookmark,
  History,
  User as UserIcon,
  Settings,
  LogOut,
  Sparkles,
  ShieldCheck,
  Layers,
  Package,
  ArrowLeftRight,
  Spade,
  Swords,
  ShoppingBag,
  Coins,
  Crown,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsPro } from "@/hooks/useIsPro";

function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name.slice(0, 2).toUpperCase();
}

export function Header() {
  const { user, profile, signOut } = useAuth();
  const isPro = useIsPro();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const nav = useNavigate();

  // Close avatar dropdown on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  // Close drawer on route change is implicit (Link navigations re-render)
  useEffect(() => {
    if (drawerOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  // Unread notifications count — realtime via subscription, plus initial fetch
  const { data: unreadCount = 0, refetch: refetchUnread } = useQuery({
    queryKey: ["notifications-unread", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("read", false);
      return count ?? 0;
    },
  });

  // Admin role check
  const { data: isAdmin = false } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`header-notif:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => refetchUnread(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, refetchUnread]);

  const handleSignOut = async () => {
    await signOut();
    setMenuOpen(false);
    setDrawerOpen(false);
    nav({ to: "/" });
  };

  return (
    <>
      <header className="sticky top-0 z-40 h-14 border-b border-border bg-[#0d0d10]/95 backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-3">
          {/* Left: hamburger */}
          <button
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
            className="p-2 -ml-2 rounded-md hover:bg-secondary transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Center: logo */}
          <Link to="/" className="font-mono text-xl font-bold tracking-tight text-foreground">
            RAWL
          </Link>

          {/* Right: bell + avatar */}
          <div className="flex items-center gap-2">

          {user && (
            <Link
              to="/notifications"
              aria-label="Notifications"
              className="relative flex h-8 w-8 items-center justify-center rounded-full hover:bg-secondary transition-colors"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
          )}

          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Open user menu"
                className="relative flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground hover:opacity-90 transition"
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                ) : (
                  initials(profile?.username)
                )}
              </button>

              {menuOpen && (
                <AvatarDropdown
                  username={profile?.username ?? "you"}
                  plan={profile?.plan ?? "free"}
                  avatarUrl={profile?.avatar_url}
                  inkBalance={profile?.ink_balance ?? 0}
                  unreadCount={unreadCount}
                  isAdmin={isAdmin}
                  isPro={isPro}
                  onSignOut={handleSignOut}
                  onClose={() => setMenuOpen(false)}
                />
              )}
            </div>
          ) : (
            <Button asChild size="sm" variant="outline" className="h-8 px-3 text-xs">
              <Link to="/signin">Sign In</Link>
            </Button>
          )}
          </div>
        </div>
      </header>

      {drawerOpen && (
        <Drawer
          username={profile?.username}
          avatarUrl={profile?.avatar_url}
          isLoggedIn={!!user}
          isAdmin={isAdmin}
          isPro={isPro}
          profileGuildId={(profile as any)?.guild_id ?? null}
          onClose={() => setDrawerOpen(false)}
          onSignOut={handleSignOut}
        />
      )}
    </>
  );
}

function AvatarDropdown({
  username,
  plan,
  avatarUrl,
  inkBalance,
  unreadCount,
  isAdmin,
  isPro,
  onSignOut,
  onClose,
}: {
  username: string;
  plan: string;
  avatarUrl?: string | null;
  inkBalance: number;
  unreadCount: number;
  isAdmin: boolean;
  isPro: boolean;
  onSignOut: () => void;
  onClose: () => void;
}) {
  const items = [
    { icon: Bell, label: "Notifications", to: "/notifications", badge: unreadCount },
    { icon: MessageSquare, label: "Messages", to: "/messages" },
    { icon: Users, label: "Friends", to: "/friends" },
    { icon: Heart, label: "Favorites", to: "/favorites" },
    { icon: Bookmark, label: "Reading List", to: "/bookmarks" },
    { icon: History, label: "Reading History", to: "/history" },
    { icon: UserIcon, label: "My Profile", to: "/profile" },
    { icon: Spade, label: "My Cards", to: "/my-cards" },
    { icon: ArrowLeftRight, label: "Exchanges", to: "/exchanges" },
    { icon: Package, label: "Open Packs", to: "/packs" },
    { icon: Layers, label: "Decks", to: "/decks" },
    { icon: Coins, label: "Top Up Ink", to: "/topup" },
    ...(!isPro ? [{ icon: Crown, label: "Upgrade to PRO", to: "/pricing" as const, highlight: true }] : []),
    { icon: Settings, label: "Settings", to: "/settings" },
    ...(isAdmin ? [{ icon: ShieldCheck, label: "Admin", to: "/admin" as const }] : []),
  ] as const;

  return (
    <div className="absolute right-0 top-full mt-2 w-64 max-h-[80vh] overflow-y-auto rounded-lg border border-border bg-popover shadow-xl z-50">
      <div className="p-3 flex items-center gap-3 bg-secondary/40">
        <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold overflow-hidden">
          {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : initials(username)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate">@{username}</div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide text-primary font-bold">{plan}</span>
            <span className="text-[10px] text-muted-foreground">🖊️ {inkBalance} Ink</span>
          </div>
        </div>
      </div>
      <div className="border-t border-border" />
      <nav className="py-1">
        {items.map((it) => (
          <Link
            key={it.to}
            to={it.to as any}
            onClick={onClose}
            className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-secondary transition-colors"
          >
            <it.icon className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1">{it.label}</span>
            {"badge" in it && (it as any).badge > 0 && (
              <span className="h-5 min-w-5 px-1.5 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center">
                {(it as any).badge > 9 ? "9+" : (it as any).badge}
              </span>
            )}
          </Link>
        ))}
      </nav>
      <div className="border-t border-border" />
      <button
        onClick={onSignOut}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-destructive hover:bg-secondary transition-colors"
      >
        <LogOut className="h-4 w-4" /> Sign Out
      </button>
    </div>
  );
}

function Drawer({
  username,
  avatarUrl,
  isLoggedIn,
  isAdmin,
  isPro,
  onClose,
  onSignOut,
}: {
  username: string | null | undefined;
  avatarUrl: string | null | undefined;
  isLoggedIn: boolean;
  isAdmin: boolean;
  isPro: boolean;
  onClose: () => void;
  onSignOut: () => void;
}) {
  const guildId = (profileGuildId ?? null) as string | null;
  const guildLink = guildId ? `/guilds/${guildId}` : "/guilds";
  const guildLabel = guildId ? "⚔️ My Guild" : "⚔️ Guilds";

  const navItems = [
    { label: "Home", to: "/" },
    { label: "Billboard", to: "/billboard" },
    { label: "Catalogue", to: "/catalogue" },
    { label: "Novels", to: "/novels" },
    { label: "Card Catalog", to: "/cards", icon: Spade },
    { label: guildLabel, to: guildLink },
    { label: "🛍️ Shop", to: "/shop" },
    { label: "🃏 Marketplace", to: "/marketplace" },
    { label: "🖊️ Top Up Ink", to: "/topup" },
    ...(!isPro ? [{ label: "👑 Go PRO", to: "/pricing", highlight: true }] : []),
    { label: "Translate", to: "/translate", icon: Sparkles },
    { label: "Leaderboard", to: "/leaderboard" },
    { label: "What's New", to: "/updates" },
  ] as const;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60 animate-in fade-in" onClick={onClose} />
      <aside className="absolute left-0 top-0 h-full w-[82vw] max-w-[320px] bg-[#0d0d10] border-r border-border flex flex-col animate-in slide-in-from-left">
        <div className="flex items-center justify-between p-3 h-14 border-b border-border">
          <span className="font-mono text-lg font-bold">RAWL</span>
          <button aria-label="Close menu" onClick={onClose} className="p-2 rounded-md hover:bg-secondary">
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoggedIn && (
          <Link
            to="/profile"
            onClick={onClose}
            className="flex items-center gap-3 p-3 hover:bg-secondary border-b border-border"
          >
            <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold overflow-hidden">
              {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : initials(username)}
            </div>
            <div className="text-sm font-semibold">@{username ?? "you"}</div>
          </Link>
        )}

        <nav className="flex-1 overflow-y-auto py-2">
          {navItems.map((it) => (
            <Link
              key={it.to}
              to={it.to as any}
              onClick={onClose}
              className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-secondary transition-colors"
            >
              {"icon" in it && (it as any).icon ? <Sparkles className="h-4 w-4 text-primary" /> : null}
              <span>{it.label}</span>
            </Link>
          ))}



          <div className="my-2 border-t border-border" />

          {isLoggedIn ? (
            <>
              <Link to="/profile" onClick={onClose} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-secondary">
                <UserIcon className="h-4 w-4" /> My Profile
              </Link>
              <Link to="/settings" onClick={onClose} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-secondary">
                <Settings className="h-4 w-4" /> Settings
              </Link>
              {isAdmin && (
                <Link to="/admin" onClick={onClose} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-secondary">
                  <ShieldCheck className="h-4 w-4 text-primary" /> Admin
                </Link>
              )}
              <button onClick={onSignOut} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-destructive hover:bg-secondary">
                <LogOut className="h-4 w-4" /> Sign Out
              </button>
            </>
          ) : (
            <>
              <Link to="/signin" onClick={onClose} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-secondary">
                Sign In
              </Link>
              <Link to="/signup" onClick={onClose} className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-primary hover:bg-secondary">
                Sign Up
              </Link>
            </>
          )}
        </nav>
      </aside>
    </div>
  );
}
