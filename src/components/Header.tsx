import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export function Header() {
  const { user, profile, signOut } = useAuth();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link to="/" className="font-mono text-2xl font-bold tracking-tight text-foreground">
          RAWL
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link to="/billboard" className="text-muted-foreground hover:text-foreground transition-colors">Billboard</Link>
          <Link to="/catalogue" className="text-muted-foreground hover:text-foreground transition-colors">Catalogue</Link>
          <Link to="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
          <span className="text-muted-foreground/40 cursor-not-allowed" title="Coming soon">Novels</span>
          {user ? (
            <>
              <Link to="/profile" className="text-foreground hover:text-primary transition-colors">
                @{profile?.username ?? "you"}
              </Link>
              <Button size="sm" variant="ghost" onClick={() => signOut()}>Sign out</Button>
            </>
          ) : (
            <>
              <Link to="/signin" className="text-muted-foreground hover:text-foreground transition-colors">Sign in</Link>
              <Button size="sm" asChild><Link to="/signup">Sign up</Link></Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
