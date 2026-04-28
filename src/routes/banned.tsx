import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Ban } from "lucide-react";

export const Route = createFileRoute("/banned")({
  component: BannedPage,
});

function BannedPage() {
  const { signOut } = useAuth();
  useEffect(() => {
    // Sign out automatically when landing here
    signOut().catch(() => {});
  }, [signOut]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <Ban className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold">Account suspended</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account has been suspended. If you think this is a mistake, please contact support.
        </p>
        <Button asChild className="mt-6" variant="outline">
          <Link to="/">Back to home</Link>
        </Button>
      </div>
    </div>
  );
}
