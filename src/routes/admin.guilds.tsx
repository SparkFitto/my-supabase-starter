import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { notifyGuild } from "@/lib/guilds";

export const Route = createFileRoute("/admin/guilds")({
  head: () => ({ meta: [{ title: "Admin · Guilds — RAWL" }] }),
  component: AdminGuilds,
});

function AdminGuilds() {
  const [tab, setTab] = useState<"all" | "wars">("all");
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Guilds</h1>
      <div className="flex gap-4 border-b border-border mb-4">
        {(["all", "wars"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`py-2 text-sm font-medium border-b-2 capitalize ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
          >
            {t === "all" ? "All Guilds" : "Wars"}
          </button>
        ))}
      </div>
      {tab === "all" ? <AllGuildsTab /> : <WarsAdminTab />}
    </div>
  );
}

function AllGuildsTab() {
  const [q, setQ] = useState("");
  const { data: guilds = [], refetch } = useQuery({
    queryKey: ["admin-guilds", q],
    queryFn: async () => {
      let query = supabase.from("guilds").select("*").order("created_at", { ascending: false });
      if (q) query = query.ilike("name", `%${q}%`);
      const { data } = await query;
      if (!data) return [];
      const ids = (data as any[]).map((g) => g.leader_id);
      const { data: profs } = await supabase.from("user_profiles").select("id, username").in("id", ids);
      const pMap = new Map((profs ?? []).map((p: any) => [p.id, p.username]));
      return (data as any[]).map((g) => ({ ...g, leader_username: pMap.get(g.leader_id) }));
    },
  });

  const del = async (g: any) => {
    if (!confirm(`Delete guild "${g.name}"? All members will be removed.`)) return;
    const { data: mems } = await supabase.from("guild_members").select("user_id").eq("guild_id", g.id);
    const ids = (mems ?? []).map((m: any) => m.user_id);
    if (ids.length) await supabase.from("user_profiles").update({ guild_id: null } as never).in("id", ids);
    await supabase.from("guilds").delete().eq("id", g.id);
    toast.success("Deleted");
    refetch();
  };

  return (
    <div className="space-y-3">
      <Input placeholder="Search by name…" value={q} onChange={(e) => setQ(e.target.value)} />
      {(guilds as any[]).map((g) => (
        <div key={g.id} className="rounded-lg border border-border bg-card/40 p-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-secondary overflow-hidden">
            {g.avatar_url && <img src={g.avatar_url} alt="" className="h-full w-full object-cover" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{g.name}</div>
            <div className="text-xs text-muted-foreground">Lv. {g.level} · {g.member_count} members · Leader @{g.leader_username}</div>
          </div>
          <Button asChild size="sm" variant="outline"><Link to="/guilds/$guildId" params={{ guildId: g.id }}>View</Link></Button>
          <Button size="sm" variant="outline" className="text-destructive" onClick={() => del(g)}>Delete</Button>
        </div>
      ))}
    </div>
  );
}

function WarsAdminTab() {
  const [showCreate, setShowCreate] = useState(false);
  const { data: wars = [], refetch } = useQuery({
    queryKey: ["admin-wars"],
    queryFn: async () => {
      const { data } = await supabase.from("guild_wars").select("*").order("started_at", { ascending: false });
      if (!data) return [];
      const ids = Array.from(new Set((data as any[]).flatMap((w) => [w.guild_a_id, w.guild_b_id])));
      const sIds = Array.from(new Set((data as any[]).map((w) => w.series_id)));
      const [{ data: gs }, { data: ss }] = await Promise.all([
        supabase.from("guilds").select("id, name").in("id", ids),
        supabase.from("series").select("id, title").in("id", sIds),
      ]);
      const gMap = new Map((gs ?? []).map((g: any) => [g.id, g.name]));
      const sMap = new Map((ss ?? []).map((s: any) => [s.id, s.title]));
      return (data as any[]).map((w) => ({ ...w, a_name: gMap.get(w.guild_a_id), b_name: gMap.get(w.guild_b_id), series_name: sMap.get(w.series_id) }));
    },
  });

  const endWar = async (w: any) => {
    if (!confirm("End this war now?")) return;
    // Compute final scores
    const computeScore = async (guildId: string) => {
      const { data: mems } = await supabase.from("guild_members").select("user_id").eq("guild_id", guildId);
      const uids = (mems ?? []).map((m: any) => m.user_id);
      if (!uids.length) return 0;
      const { data: ucs } = await supabase
        .from("user_cards")
        .select("quantity, card:cards!inner(series_id)")
        .in("user_id", uids);
      let score = 0;
      for (const r of (ucs ?? [])) {
        if ((r as any).card?.series_id === w.series_id) score += (r as any).quantity;
      }
      return score;
    };
    const a = await computeScore(w.guild_a_id);
    const b = await computeScore(w.guild_b_id);
    const winner = a > b ? w.guild_a_id : b > a ? w.guild_b_id : null;
    await supabase.from("guild_wars").update({ status: "finished", guild_a_score: a, guild_b_score: b, winner_id: winner } as never).eq("id", w.id);
    if (winner) {
      const loser = winner === w.guild_a_id ? w.guild_b_id : w.guild_a_id;
      const { data: wn } = await supabase.from("guilds").select("name").eq("id", winner).maybeSingle();
      const { data: ln } = await supabase.from("guilds").select("name").eq("id", loser).maybeSingle();
      await notifyGuild(winner, { type: "card_drop", title: "⚔️ Victory!", body: `Your guild won the war against ${(ln as any)?.name}!`, link: `/guilds/${winner}` });
      await notifyGuild(loser, { type: "card_drop", title: "⚔️ Defeat", body: `${(wn as any)?.name} won this time. Keep collecting!`, link: `/guilds/${loser}` });
    }
    toast.success("War ended");
    refetch();
  };

  return (
    <div className="space-y-3">
      <Button onClick={() => setShowCreate(true)}>Create War</Button>
      {(wars as any[]).map((w) => (
        <div key={w.id} className="rounded-lg border border-border bg-card/40 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-semibold">{w.a_name} vs {w.b_name}</span>
            <span className="text-xs uppercase">{w.status}</span>
          </div>
          <div className="text-xs text-muted-foreground">📚 {w.series_name} · {w.guild_a_score} — {w.guild_b_score}</div>
          {w.status === "active" && (
            <Button size="sm" variant="outline" className="mt-2" onClick={() => endWar(w)}>End War Now</Button>
          )}
        </div>
      ))}
      {showCreate && <CreateWarModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); refetch(); }} />}
    </div>
  );
}

function CreateWarModal({ onClose, onCreated }: any) {
  const [aQ, setAQ] = useState(""); const [bQ, setBQ] = useState("");
  const [aSel, setASel] = useState<any>(null); const [bSel, setBSel] = useState<any>(null);
  const [seriesId, setSeriesId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const { data: aResults = [] } = useQuery({
    queryKey: ["war-search-a", aQ],
    enabled: aQ.length >= 2,
    queryFn: async () => (await supabase.from("guilds").select("id, name").ilike("name", `%${aQ}%`).limit(5)).data ?? [],
  });
  const { data: bResults = [] } = useQuery({
    queryKey: ["war-search-b", bQ],
    enabled: bQ.length >= 2,
    queryFn: async () => (await supabase.from("guilds").select("id, name").ilike("name", `%${bQ}%`).limit(5)).data ?? [],
  });
  const { data: seriesList = [] } = useQuery({
    queryKey: ["war-series-list"],
    queryFn: async () => (await supabase.from("series").select("id, title").order("title").limit(200)).data ?? [],
  });

  const create = async () => {
    if (!aSel || !bSel || !seriesId) return toast.error("Pick guilds and a series");
    if (aSel.id === bSel.id) return toast.error("Different guilds required");
    setBusy(true);
    const { error, data } = await supabase
      .from("guild_wars")
      .insert({ guild_a_id: aSel.id, guild_b_id: bSel.id, series_id: seriesId } as never)
      .select()
      .single();
    if (error) { toast.error(error.message); setBusy(false); return; }
    const seriesName = (seriesList as any[]).find((s) => s.id === seriesId)?.title;
    await notifyGuild(aSel.id, { type: "card_drop", title: "⚔️ Guild War Started!", body: `${aSel.name} vs ${bSel.name} — collect ${seriesName} cards! 7 days.`, link: `/guilds/${aSel.id}` });
    await notifyGuild(bSel.id, { type: "card_drop", title: "⚔️ Guild War Started!", body: `${bSel.name} vs ${aSel.name} — collect ${seriesName} cards! 7 days.`, link: `/guilds/${bSel.id}` });
    toast.success("War created");
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-4">
        <h3 className="font-bold mb-3">Create War</h3>
        <div className="space-y-3 text-sm">
          <div>
            <label className="text-xs text-muted-foreground">Guild A</label>
            {aSel ? (
              <div className="flex items-center gap-2 p-2 rounded-md bg-secondary">
                <span>{aSel.name}</span>
                <button onClick={() => setASel(null)} className="ml-auto text-xs">change</button>
              </div>
            ) : (
              <>
                <Input value={aQ} onChange={(e) => setAQ(e.target.value)} placeholder="Search…" />
                <div className="space-y-1 mt-1">
                  {(aResults as any[]).map((g) => (
                    <button key={g.id} onClick={() => setASel(g)} className="w-full text-left text-xs p-1.5 rounded hover:bg-secondary">{g.name}</button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Guild B</label>
            {bSel ? (
              <div className="flex items-center gap-2 p-2 rounded-md bg-secondary">
                <span>{bSel.name}</span>
                <button onClick={() => setBSel(null)} className="ml-auto text-xs">change</button>
              </div>
            ) : (
              <>
                <Input value={bQ} onChange={(e) => setBQ(e.target.value)} placeholder="Search…" />
                <div className="space-y-1 mt-1">
                  {(bResults as any[]).map((g) => (
                    <button key={g.id} onClick={() => setBSel(g)} className="w-full text-left text-xs p-1.5 rounded hover:bg-secondary">{g.name}</button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Series</label>
            <select value={seriesId} onChange={(e) => setSeriesId(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-2 text-xs">
              <option value="">Select…</option>
              {(seriesList as any[]).map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={create} disabled={busy}>Start War</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
