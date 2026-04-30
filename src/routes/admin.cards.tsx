import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CardDisplay } from "@/components/cards/CardDisplay";

export const Route = createFileRoute("/admin/cards")({
  component: AdminCardsPage,
  head: () => ({
    meta: [{ title: "Admin · Card Approval Queue" }],
  }),
});

function AdminCardsPage() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [pending, setPending] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"cards" | "suggestions">("cards");

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const roles = (data ?? []).map((r: any) => r.role);
      setIsAdmin(roles.includes("admin") || roles.includes("moderator"));
    })();
  }, [user]);

  const loadPending = async () => {
    setLoading(true);
    const [c, s] = await Promise.all([
      supabase
        .from("cards")
        .select("*")
        .eq("is_approved", false)
        .order("created_at", { ascending: false }),
      supabase
        .from("card_image_suggestions")
        .select("*, cards(name, character_name, rank, image_url)")
        .order("created_at", { ascending: false }),
    ]);
    setPending(c.data ?? []);
    setSuggestions(s.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) loadPending();
  }, [isAdmin]);

  const approveCard = async (id: string) => {
    const { error } = await supabase
      .from("cards")
      .update({ is_approved: true, approved_at: new Date().toISOString(), approved_by: user!.id })
      .eq("id", id);
    if (error) return toast.error(error.message);

    // Award Ink to submitter
    const card = pending.find((p) => p.id === id);
    if (card?.submitted_by) {
      await supabase.from("notifications").insert({
        user_id: card.submitted_by,
        type: "card_approved",
        title: "Card approved 🎴",
        body: `Your submission "${card.name}" was approved! +50 Ink awarded.`,
        link: `/cards`,
      });
    }
    toast.success("Card approved");
    loadPending();
  };

  const rejectCard = async (id: string) => {
    const card = pending.find((p) => p.id === id);
    const { error } = await supabase.from("cards").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (card?.submitted_by) {
      await supabase.from("notifications").insert({
        user_id: card.submitted_by,
        type: "card_rejected",
        title: "Card submission rejected",
        body: `Your submission "${card.name}" was not approved.`,
      });
    }
    toast.success("Card rejected");
    loadPending();
  };

  const applySuggestion = async (s: any) => {
    const { error } = await supabase
      .from("cards")
      .update({ image_url: s.image_url })
      .eq("id", s.card_id);
    if (error) return toast.error(error.message);
    await supabase.from("card_image_suggestions").delete().eq("id", s.id);
    toast.success("Image updated");
    loadPending();
  };

  const dismissSuggestion = async (id: string) => {
    await supabase.from("card_image_suggestions").delete().eq("id", id);
    loadPending();
  };

  if (isAdmin === null) {
    return <div className="container py-12 text-center text-muted-foreground">Loading…</div>;
  }
  if (!isAdmin) {
    return (
      <div className="container py-12 text-center">
        <h1 className="text-2xl font-bold mb-2">Access denied</h1>
        <p className="text-muted-foreground mb-4">You need admin or moderator role.</p>
        <Button asChild><Link to="/">Go home</Link></Button>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6">Card Approval Queue</h1>

      <div className="flex gap-2 mb-6 border-b">
        <button
          onClick={() => setTab("cards")}
          className={`px-4 py-2 -mb-px border-b-2 ${tab === "cards" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
        >
          Pending Cards <Badge variant="secondary" className="ml-2">{pending.length}</Badge>
        </button>
        <button
          onClick={() => setTab("suggestions")}
          className={`px-4 py-2 -mb-px border-b-2 ${tab === "suggestions" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
        >
          Image Suggestions <Badge variant="secondary" className="ml-2">{suggestions.length}</Badge>
        </button>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Loading…</div>
      ) : tab === "cards" ? (
        pending.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">No cards pending approval.</Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pending.map((c) => (
              <Card key={c.id} className="p-4 space-y-3">
                <CardDisplay card={c} size="md" />
                <div>
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-sm text-muted-foreground">{c.character_name}</div>
                  <div className="text-xs mt-1">Rank: <Badge variant="outline">{c.rank}</Badge></div>
                  {c.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {c.tags.map((t: string) => (
                        <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" onClick={() => approveCard(c.id)}>Approve</Button>
                  <Button size="sm" variant="destructive" className="flex-1" onClick={() => rejectCard(c.id)}>Reject</Button>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : suggestions.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">No image suggestions.</Card>
      ) : (
        <div className="space-y-3">
          {suggestions.map((s) => (
            <Card key={s.id} className="p-4 flex gap-4 items-start">
              <div className="flex gap-3">
                <div className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">Current</div>
                  {s.cards?.image_url && (
                    <img src={s.cards.image_url} alt="current" className="w-24 h-32 object-cover rounded" />
                  )}
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">Suggested</div>
                  <img src={s.image_url} alt="suggested" className="w-24 h-32 object-cover rounded" />
                </div>
              </div>
              <div className="flex-1">
                <div className="font-semibold">{s.cards?.name}</div>
                <div className="text-sm text-muted-foreground">{s.cards?.character_name}</div>
                {s.reason && <p className="text-sm mt-2">{s.reason}</p>}
                <div className="flex gap-2 mt-3">
                  <Button size="sm" onClick={() => applySuggestion(s)}>Apply</Button>
                  <Button size="sm" variant="outline" onClick={() => dismissSuggestion(s.id)}>Dismiss</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
