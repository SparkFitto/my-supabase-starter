import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/glossary")({
  component: AdminGlossary,
});

function AdminGlossary() {
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      throw redirect({ to: "/signin" });
    }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user, loading]);

  const { data: pending, refetch } = useQuery({
    queryKey: ["pending-glossary"],
    queryFn: async () => {
      const { data } = await supabase
        .from("series_glossary")
        .select("*, series:series(title, slug)")
        .eq("approved", false)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: isAdmin === true,
  });

  const approve = async (id: string) => {
    const { error } = await supabase.from("series_glossary").update({ approved: true }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Approved"); refetch(); }
  };

  const reject = async (id: string) => {
    const { error } = await supabase.from("series_glossary").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Rejected"); refetch(); }
  };

  if (loading || isAdmin === null) {
    return <div className="min-h-screen bg-background"><Header /><div className="p-8 text-center text-muted-foreground">Loading…</div></div>;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background"><Header />
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <h1 className="text-2xl font-bold">Admins only</h1>
          <p className="mt-2 text-sm text-muted-foreground">You need an admin role to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold">Glossary suggestions</h1>
        {!pending?.length && <p className="text-sm text-muted-foreground">No pending suggestions.</p>}
        <div className="space-y-3">
          {pending?.map((g) => {
            const s = g.series as { title?: string; slug?: string } | null;
            return (
              <div key={g.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-mono text-xs text-muted-foreground">{s?.title ?? "—"} · {g.target_language.toUpperCase()}</p>
                    <p className="mt-1"><span className="font-medium">{g.original_term}</span> → <span className="text-primary">{g.translated_term}</span></p>
                  </div>
                  <Badge variant="outline">pending</Badge>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => approve(g.id)}>Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => reject(g.id)}>Reject</Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
