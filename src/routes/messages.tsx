import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, ArrowLeft, MessageSquare } from "lucide-react";
import { timeAgo } from "@/lib/constants";
import { toast } from "sonner";

export const Route = createFileRoute("/messages")({
  head: () => ({ meta: [{ title: "Messages — RAWL" }] }),
  component: MessagesPage,
});

type Conversation = {
  id: string;
  user1_id: string;
  user2_id: string;
  last_message_at: string;
};
type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
};
type Profile = { id: string; username: string | null; avatar_url: string | null };

function MessagesPage() {
  const { user, loading } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [friends, setFriends] = useState<Profile[]>([]);
  const [showNew, setShowNew] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // load conversations
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("conversations")
        .select("*")
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order("last_message_at", { ascending: false });
      const list = (data ?? []) as Conversation[];
      setConversations(list);

      const ids = Array.from(new Set(list.flatMap((c) => [c.user1_id, c.user2_id])));
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
      .channel(`conversations:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  // load friends for new-message picker
  useEffect(() => {
    if (!user || !showNew) return;
    (async () => {
      const { data: fs } = await supabase
        .from("friendships")
        .select("requester_id, addressee_id")
        .eq("status", "accepted")
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
      const ids = (fs ?? []).map((f: any) => (f.requester_id === user.id ? f.addressee_id : f.requester_id));
      if (ids.length) {
        const { data: profs } = await supabase.from("user_profiles").select("id, username, avatar_url").in("id", ids);
        setFriends((profs ?? []) as Profile[]);
      } else setFriends([]);
    })();
  }, [showNew, user?.id]);

  // load messages for active convo + realtime
  useEffect(() => {
    if (!activeId || !user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", activeId)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      setMessages((data ?? []) as Message[]);
      // mark unread as read
      await supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .eq("conversation_id", activeId)
        .neq("sender_id", user.id)
        .is("read_at", null);
    })();

    const channel = supabase
      .channel(`msg:${activeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (m.sender_id !== user.id) {
            supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("id", m.id).then(() => {});
          }
        },
      )
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [activeId, user?.id]);

  // autoscroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, activeId]);

  if (loading) return null;
  if (!user) throw redirect({ to: "/signin" });

  const active = conversations.find((c) => c.id === activeId);
  const otherId = active ? (active.user1_id === user.id ? active.user2_id : active.user1_id) : null;
  const other = otherId ? profiles[otherId] : null;

  const send = async () => {
    if (!activeId || !text.trim()) return;
    const body = text.trim().slice(0, 4000);
    setText("");
    const { error } = await supabase.from("messages").insert({
      conversation_id: activeId,
      sender_id: user.id,
      content: body,
    });
    if (error) { toast.error(error.message); return; }
    await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", activeId);
    if (otherId) {
      await supabase.from("notifications").insert({
        user_id: otherId,
        type: "message",
        title: "New message",
        body: body.slice(0, 80),
        link: "/messages",
      } as any).then(() => {});
    }
  };

  const startWith = async (friend: Profile) => {
    const a = user.id < friend.id ? user.id : friend.id;
    const b = user.id < friend.id ? friend.id : user.id;
    const { data: existing } = await supabase
      .from("conversations")
      .select("*")
      .or(`and(user1_id.eq.${a},user2_id.eq.${b}),and(user1_id.eq.${b},user2_id.eq.${a})`)
      .maybeSingle();
    if (existing) {
      setActiveId(existing.id);
      setShowNew(false);
      return;
    }
    const { data, error } = await supabase
      .from("conversations")
      .insert({ user1_id: a, user2_id: b })
      .select("*")
      .single();
    if (error) { toast.error(error.message); return; }
    setConversations((prev) => [data as Conversation, ...prev]);
    setProfiles((prev) => ({ ...prev, [friend.id]: friend }));
    setActiveId((data as Conversation).id);
    setShowNew(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-0 sm:px-4 py-0 sm:py-6">
        <div className="flex h-[calc(100vh-3.5rem-env(safe-area-inset-bottom))] sm:h-[calc(100vh-7rem)] sm:rounded-xl sm:border sm:border-border overflow-hidden bg-card">
          {/* Sidebar */}
          <aside className={`${activeId ? "hidden sm:flex" : "flex"} w-full sm:w-72 flex-col border-r border-border`}>
            <div className="flex items-center justify-between p-3 border-b border-border">
              <h1 className="font-semibold">Messages</h1>
              <Button size="sm" onClick={() => setShowNew((v) => !v)}>New</Button>
            </div>
            {showNew && (
              <div className="p-2 border-b border-border bg-secondary/30">
                <p className="text-xs text-muted-foreground mb-2">Pick a friend:</p>
                {friends.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No friends yet.</p>
                ) : friends.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => startWith(f)}
                    className="w-full flex items-center gap-2 p-2 rounded hover:bg-muted text-left"
                  >
                    <Avatar className="h-7 w-7"><AvatarImage src={f.avatar_url ?? undefined} /><AvatarFallback className="text-[10px]">{(f.username ?? "?")[0]?.toUpperCase()}</AvatarFallback></Avatar>
                    <span className="text-sm">@{f.username}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="flex-1 overflow-y-auto">
              {conversations.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  No conversations yet
                </div>
              ) : conversations.map((c) => {
                const oid = c.user1_id === user.id ? c.user2_id : c.user1_id;
                const p = profiles[oid];
                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveId(c.id)}
                    className={`w-full flex items-center gap-3 p-3 hover:bg-secondary/40 border-b border-border text-left ${activeId === c.id ? "bg-secondary/60" : ""}`}
                  >
                    <Avatar className="h-9 w-9"><AvatarImage src={p?.avatar_url ?? undefined} /><AvatarFallback>{(p?.username ?? "?")[0]?.toUpperCase()}</AvatarFallback></Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">@{p?.username ?? "unknown"}</div>
                      <div className="text-xs text-muted-foreground">{timeAgo(c.last_message_at)}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Thread */}
          <section className={`${activeId ? "flex" : "hidden sm:flex"} flex-1 flex-col`}>
            {!activeId ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                Select a conversation
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 p-3 border-b border-border">
                  <button className="sm:hidden p-1" onClick={() => setActiveId(null)}><ArrowLeft className="h-5 w-5" /></button>
                  <Avatar className="h-8 w-8"><AvatarImage src={other?.avatar_url ?? undefined} /><AvatarFallback>{(other?.username ?? "?")[0]?.toUpperCase()}</AvatarFallback></Avatar>
                  <div className="font-medium text-sm">@{other?.username ?? "unknown"}</div>
                </div>
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
                  {messages.map((m) => {
                    const mine = m.sender_id === user.id;
                    return (
                      <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                          <div className="whitespace-pre-wrap break-words">{m.content}</div>
                          <div className={`text-[10px] mt-0.5 ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{timeAgo(m.created_at)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="border-t border-border p-2 flex gap-2">
                  <Input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                    placeholder="Type a message…"
                  />
                  <Button onClick={send} disabled={!text.trim()}><Send className="h-4 w-4" /></Button>
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
