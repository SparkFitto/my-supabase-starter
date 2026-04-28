import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Check, X, UserPlus, Search, MessageSquare } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/friends")({
  head: () => ({ meta: [{ title: "Friends — RAWL" }] }),
  component: FriendsPage,
});

type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
  created_at: string;
};

type Profile = { id: string; username: string | null; avatar_url: string | null };

function FriendsPage() {
  const { user, loading } = useAuth();
  const [rows, setRows] = useState<Friendship[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [searchQ, setSearchQ] = useState("");
  const [results, setResults] = useState<Profile[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("friendships")
        .select("*")
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
        .order("created_at", { ascending: false });
      const list = (data ?? []) as Friendship[];
      setRows(list);

      const ids = Array.from(new Set(list.flatMap((r) => [r.requester_id, r.addressee_id])));
      if (ids.length) {
        const { data: profs } = await supabase
          .from("user_profiles")
          .select("id, username, avatar_url")
          .in("id", ids);
        setProfiles(Object.fromEntries((profs ?? []).map((p) => [p.id, p as Profile])));
      }
    };
    load();

    const channel = supabase
      .channel(`friendships:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  if (loading) return null;
  if (!user) throw redirect({ to: "/signin" });

  const accepted = rows.filter((r) => r.status === "accepted");
  const incoming = rows.filter((r) => r.status === "pending" && r.addressee_id === user.id);
  const outgoing = rows.filter((r) => r.status === "pending" && r.requester_id === user.id);

  const respond = async (id: string, accept: boolean) => {
    if (accept) {
      const { error } = await supabase
        .from("friendships")
        .update({ status: "accepted", accepted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) toast.error(error.message);
      else toast.success("Friend added");
    } else {
      const { error } = await supabase.from("friendships").delete().eq("id", id);
      if (error) toast.error(error.message);
      else toast.success("Request declined");
    }
  };

  const cancel = async (id: string) => {
    await supabase.from("friendships").delete().eq("id", id);
    toast.success("Removed");
  };

  const doSearch = async () => {
    if (!searchQ.trim()) { setResults([]); return; }
    const { data } = await supabase
      .from("user_profiles")
      .select("id, username, avatar_url")
      .ilike("username", `%${searchQ.trim()}%`)
      .neq("id", user.id)
      .limit(15);
    setResults((data ?? []) as Profile[]);
  };

  const sendRequest = async (addresseeId: string) => {
    // prevent dupes
    const { data: dup } = await supabase
      .from("friendships")
      .select("id")
      .or(`and(requester_id.eq.${user.id},addressee_id.eq.${addresseeId}),and(requester_id.eq.${addresseeId},addressee_id.eq.${user.id})`)
      .maybeSingle();
    if (dup) { toast.error("Request already exists"); return; }
    const { error } = await supabase.from("friendships").insert({
      requester_id: user.id,
      addressee_id: addresseeId,
      status: "pending",
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Request sent");
      // notify recipient
      await supabase.from("notifications").insert({
        user_id: addresseeId,
        type: "friend_request",
        title: "New friend request",
        body: `Someone wants to be your friend`,
        link: "/friends",
      } as any).then(() => {});
    }
  };

  const renderRow = (other: Profile, actions: React.ReactNode) => (
    <div key={other.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
      <Avatar className="h-10 w-10">
        <AvatarImage src={other.avatar_url ?? undefined} />
        <AvatarFallback>{(other.username ?? "?")[0]?.toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        {other.username ? (
          <Link to="/profile/$username" params={{ username: other.username }} className="font-medium hover:text-primary">
            @{other.username}
          </Link>
        ) : <span className="text-muted-foreground text-sm">unknown</span>}
      </div>
      <div className="flex gap-2">{actions}</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="text-2xl font-bold mb-4">Friends</h1>

        <Tabs defaultValue="friends">
          <TabsList>
            <TabsTrigger value="friends">Friends ({accepted.length})</TabsTrigger>
            <TabsTrigger value="incoming">Incoming ({incoming.length})</TabsTrigger>
            <TabsTrigger value="outgoing">Outgoing ({outgoing.length})</TabsTrigger>
            <TabsTrigger value="find">Find</TabsTrigger>
          </TabsList>

          <TabsContent value="friends" className="mt-4 space-y-2">
            {accepted.length === 0 ? (
              <p className="text-sm text-muted-foreground">No friends yet. Use the Find tab to connect with people.</p>
            ) : accepted.map((f) => {
              const otherId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
              const other = profiles[otherId] ?? { id: otherId, username: null, avatar_url: null };
              return renderRow(other,
                <>
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/messages"><MessageSquare className="h-4 w-4" /></Link>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => cancel(f.id)}>Remove</Button>
                </>
              );
            })}
          </TabsContent>

          <TabsContent value="incoming" className="mt-4 space-y-2">
            {incoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">No incoming requests.</p>
            ) : incoming.map((f) => {
              const other = profiles[f.requester_id] ?? { id: f.requester_id, username: null, avatar_url: null };
              return renderRow(other,
                <>
                  <Button size="sm" onClick={() => respond(f.id, true)}><Check className="h-4 w-4" /></Button>
                  <Button size="sm" variant="outline" onClick={() => respond(f.id, false)}><X className="h-4 w-4" /></Button>
                </>
              );
            })}
          </TabsContent>

          <TabsContent value="outgoing" className="mt-4 space-y-2">
            {outgoing.length === 0 ? (
              <p className="text-sm text-muted-foreground">No outgoing requests.</p>
            ) : outgoing.map((f) => {
              const other = profiles[f.addressee_id] ?? { id: f.addressee_id, username: null, avatar_url: null };
              return renderRow(other,
                <Button size="sm" variant="ghost" onClick={() => cancel(f.id)}>Cancel</Button>
              );
            })}
          </TabsContent>

          <TabsContent value="find" className="mt-4">
            <div className="flex gap-2 mb-3">
              <Input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doSearch()}
                placeholder="Search by username…"
              />
              <Button onClick={doSearch}><Search className="h-4 w-4" /></Button>
            </div>
            <div className="space-y-2">
              {results.map((p) => renderRow(p,
                <Button size="sm" onClick={() => sendRequest(p.id)}><UserPlus className="h-4 w-4 mr-1" />Add</Button>
              ))}
              {results.length === 0 && searchQ && <p className="text-sm text-muted-foreground">No results.</p>}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
