import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Crown, Shield, Swords, Users as UsersIcon, X } from "lucide-react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { addMember, timeRemaining } from "@/lib/guilds";

const REGIONS = [
  { value: "global", label: "🌍 Global" },
  { value: "en", label: "🇺🇸 English" },
  { value: "es", label: "🇪🇸 Español / Latino" },
  { value: "pt", label: "🇧🇷 Português / Brasil" },
  { value: "fr", label: "🇫🇷 Français" },
  { value: "ru", label: "🇷🇺 Русский" },
  { value: "id", label: "🇮🇩 Indonesian" },
] as const;

export const Route = createFileRoute("/guilds")({
  head: () => ({
    meta: [
      { title: "Guilds — RAWL" },
      { name: "description", content: "Join a guild, fight in wars, and collect cards together on RAWL." },
      { property: "og:title", content: "Guilds — RAWL" },
      { property: "og:description", content: "Join a guild, fight in wars, and collect cards together on RAWL." },
    ],
  }),
  component: GuildsPage,
});

const JOIN_BADGES: Record<string, { label: string; cls: string }> = {
  open: { label: "Open", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  request: { label: "Request", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  closed: { label: "Closed", cls: "bg-muted text-muted-foreground border-border" },
};

const POSITION_CROWN = ["text-amber-400", "text-zinc-300", "text-orange-400"];

function GuildsPage() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [sort, setSort] = useState<"level" | "members" | "newest">("level");
  const [regionFilter, setRegionFilter] = useState<string>("all");

  const { data: top3 = [] } = useQuery({
    queryKey: ["guilds-top3"],
    queryFn: async () => {
      const { data } = await supabase
        .from("guilds")
        .select("*")
        .order("xp", { ascending: false })
        .limit(3);
      return data ?? [];
    },
  });

  const { data: wars = [] } = useQuery({
    queryKey: ["guilds-active-wars"],
    queryFn: async () => {
      const { data } = await supabase
        .from("guild_wars")
        .select("*")
        .eq("status", "active")
        .order("ends_at");
      if (!data) return [];
      const ids = Array.from(new Set((data as any[]).flatMap((w) => [w.guild_a_id, w.guild_b_id])));
      const seriesIds = Array.from(new Set((data as any[]).map((w) => w.series_id)));
      const [{ data: gs }, { data: ss }] = await Promise.all([
        supabase.from("guilds").select("id, name, avatar_url").in("id", ids),
        supabase.from("series").select("id, title, slug").in("id", seriesIds),
      ]);
      const gMap = new Map((gs ?? []).map((g: any) => [g.id, g]));
      const sMap = new Map((ss ?? []).map((s: any) => [s.id, s]));
      return (data as any[]).map((w) => ({
        ...w,
        guild_a: gMap.get(w.guild_a_id),
        guild_b: gMap.get(w.guild_b_id),
        series: sMap.get(w.series_id),
      }));
    },
  });

  // Realtime: keep wars list/scores live
  useEffect(() => {
    const ch = supabase
      .channel("guilds-wars-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "guild_wars" }, () => {
        qc.invalidateQueries({ queryKey: ["guilds-active-wars"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  // Realtime: keep guild list live (member counts, xp)
  useEffect(() => {
    const ch = supabase
      .channel("guilds-list-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "guilds" }, () => {
        qc.invalidateQueries({ queryKey: ["guilds-all"] });
        qc.invalidateQueries({ queryKey: ["guilds-top3"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const { data: allGuilds = [], refetch } = useQuery({
    queryKey: ["guilds-all", sort, regionFilter],
    queryFn: async () => {
      let q = supabase.from("guilds").select("*");
      if (regionFilter !== "all") q = q.eq("region" as any, regionFilter);
      if (sort === "level") q = q.order("level", { ascending: false }).order("member_count", { ascending: false });
      else if (sort === "members") q = q.order("member_count", { ascending: false });
      else q = q.order("created_at", { ascending: false });
      const { data } = await q;
      return data ?? [];
    },
  });

  const myGuildId = (profile as any)?.guild_id ?? null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-7xl px-4 py-6 space-y-10">
        {/* SECTION 1 — Top guilds */}
        <section>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Crown className="h-5 w-5 text-amber-400" /> Weekly Top Guilds</h2>
          {top3.length === 0 ? (
            <div className="rounded-xl border border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
              No guilds yet — be the first to create one.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              {(top3 as any[]).map((g, i) => (
                <Link
                  key={g.id}
                  to="/guilds/$guildId"
                  params={{ guildId: g.id }}
                  className="relative h-[200px] rounded-xl overflow-hidden border border-border group"
                >
                  {g.banner_url ? (
                    <img src={g.banner_url} alt="" className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div
                      className="absolute inset-0"
                      style={{ background: "linear-gradient(135deg, hsl(180 40% 18%), hsl(265 40% 22%))" }}
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
                  <Crown className={`absolute top-3 right-3 h-8 w-8 drop-shadow ${POSITION_CROWN[i] ?? "text-muted-foreground"}`} />
                  <div className="absolute bottom-3 left-3 right-3 flex items-end gap-3">
                    <div className="h-12 w-12 shrink-0 rounded-full bg-secondary border-2 border-background overflow-hidden">
                      {g.avatar_url && <img src={g.avatar_url} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-white truncate">{g.name}</div>
                      <div className="text-xs text-white/70 flex items-center gap-2">
                        <span className="rounded px-1.5 py-0.5 bg-primary/30 text-primary-foreground font-bold">Lv. {g.level}</span>
                        <span>{g.member_count} members</span>
                        <span>· {g.xp.toLocaleString()} XP</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* SECTION 2 — Active wars */}
        <section>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Swords className="h-5 w-5 text-destructive" />
            Active Guild Wars
            <span className="ml-1 inline-flex items-center gap-1.5 text-xs text-emerald-400 font-normal">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> live
            </span>
          </h2>
          {wars.length === 0 ? (
            <div className="rounded-xl border border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">No active wars.</div>
          ) : (
            <div className="space-y-3">
              {(wars as any[]).map((w) => {
                const total = w.guild_a_score + w.guild_b_score;
                const pa = total ? (w.guild_a_score / total) * 100 : 50;
                return (
                  <div key={w.id} className="rounded-xl border border-border bg-card/40 p-4">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-8 w-8 rounded-full bg-secondary overflow-hidden shrink-0">
                          {w.guild_a?.avatar_url && <img src={w.guild_a.avatar_url} alt="" className="h-full w-full object-cover" />}
                        </div>
                        <span className="font-semibold truncate">{w.guild_a?.name ?? "Guild A"}</span>
                      </div>
                      <div className="text-xs font-mono text-muted-foreground shrink-0">
                        {w.guild_a_score} <span className="mx-1.5">vs</span> {w.guild_b_score}
                      </div>
                      <div className="flex items-center gap-2 min-w-0 justify-end">
                        <span className="font-semibold truncate">{w.guild_b?.name ?? "Guild B"}</span>
                        <div className="h-8 w-8 rounded-full bg-secondary overflow-hidden shrink-0">
                          {w.guild_b?.avatar_url && <img src={w.guild_b.avatar_url} alt="" className="h-full w-full object-cover" />}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-secondary overflow-hidden flex">
                      <div className="bg-primary" style={{ width: `${pa}%` }} />
                      <div className="bg-destructive flex-1" />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>📚 {w.series?.title ?? "Series"}</span>
                      <span>⏱ {timeRemaining(w.ends_at)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* SECTION 3 — All guilds */}
        <section>
          <div className="flex items-center justify-between mb-4 gap-2">
            <h2 className="text-xl font-bold">All Guilds <span className="text-muted-foreground text-sm">({allGuilds.length})</span></h2>
            <div className="flex items-center gap-2">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as any)}
                className="h-9 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="level">By Level</option>
                <option value="members">By Members</option>
                <option value="newest">Newest</option>
              </select>
              <Button onClick={() => setShowCreate(true)} className="bg-primary text-primary-foreground">Create Guild</Button>
            </div>
          </div>

          {/* Region filter tabs */}
          <div className="mb-4 flex flex-wrap gap-1.5">
            {[{ value: "all", label: "All" }, ...REGIONS].map((r) => (
              <button
                key={r.value}
                onClick={() => setRegionFilter(r.value)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  regionFilter === r.value
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40"
                }`}
              >{r.label}</button>
            ))}
          </div>

          {allGuilds.length === 0 ? (
            <div className="rounded-xl border border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
              No guilds yet.
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
              {(allGuilds as any[]).map((g) => {
                const badge = JOIN_BADGES[g.join_type] ?? JOIN_BADGES.open;
                const isMember = myGuildId === g.id;
                return (
                  <Link
                    key={g.id}
                    to="/guilds/$guildId"
                    params={{ guildId: g.id }}
                    className="rounded-xl border border-border bg-card/40 overflow-hidden hover:border-primary/40 transition-colors"
                  >
                    <div className="relative h-20 bg-secondary">
                      {g.banner_url ? (
                        <img src={g.banner_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full" style={{ background: "linear-gradient(135deg, hsl(180 40% 18%), hsl(265 40% 22%))" }} />
                      )}
                      <div className="absolute -bottom-5 left-3 h-12 w-12 rounded-full bg-secondary border-2 border-card overflow-hidden">
                        {g.avatar_url && <img src={g.avatar_url} alt="" className="h-full w-full object-cover" />}
                      </div>
                    </div>
                    <div className="pt-7 px-3 pb-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold truncate">{g.name}</span>
                        <span className="text-[10px] rounded bg-primary/15 text-primary px-1.5 py-0.5 font-bold shrink-0">Lv. {g.level}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1"><UsersIcon className="h-3 w-3" />{g.member_count}</span>
                        <span className={`rounded border px-1.5 py-0.5 ${badge.cls}`}>{isMember ? "Member" : badge.label}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {showCreate && user && (
        <CreateGuildModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); refetch(); }}
          inkBalance={profile?.ink_balance ?? 0}
          alreadyInGuild={!!myGuildId}
        />
      )}
      {showCreate && !user && (
        <SimpleModal onClose={() => setShowCreate(false)} title="Sign in required">
          <p className="text-sm text-muted-foreground">You need to be signed in to create a guild.</p>
          <div className="mt-4 flex justify-end"><Button asChild><Link to="/signin">Sign in</Link></Button></div>
        </SimpleModal>
      )}
    </div>
  );
}

function SimpleModal({ children, title, onClose }: { children: any; title: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CreateGuildModal({
  onClose,
  onCreated,
  inkBalance,
  alreadyInGuild,
}: {
  onClose: () => void;
  onCreated: () => void;
  inkBalance: number;
  alreadyInGuild: boolean;
}) {
  const { user } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [joinType, setJoinType] = useState<"open" | "request" | "closed">("open");
  const [region, setRegion] = useState<string>("global");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [banner, setBanner] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit =
    !alreadyInGuild &&
    inkBalance >= 1000 &&
    name.trim().length >= 2 &&
    name.trim().length <= 40 &&
    !!avatar &&
    !busy;

  const submit = async () => {
    if (!user) return;
    setBusy(true);
    try {
      // unique name check
      const { data: existing } = await supabase.from("guilds").select("id").ilike("name", name.trim()).maybeSingle();
      if (existing) {
        toast.error("Guild name already taken");
        setBusy(false);
        return;
      }
      // spend ink
      const { error: spendErr } = await supabase.rpc("spend_ink" as any, { _amount: 1000, _source: "guild_creation" } as any);
      if (spendErr) {
        toast.error(spendErr.message);
        setBusy(false);
        return;
      }
      const { data: guild, error } = await supabase
        .from("guilds")
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          join_type: joinType,
          region,
          leader_id: user.id,
          member_count: 1,
        } as never)
        .select()
        .single();
      if (error || !guild) throw error ?? new Error("Failed to create guild");

      const gid = (guild as any).id;
      // Upload avatar
      let avatarUrl: string | null = null;
      let bannerUrl: string | null = null;
      if (avatar) {
        const ext = avatar.name.split(".").pop() ?? "jpg";
        const path = `${gid}/avatar.${ext}`;
        const { error: upErr } = await supabase.storage.from("guild-avatars").upload(path, avatar, { upsert: true, contentType: avatar.type });
        if (!upErr) avatarUrl = supabase.storage.from("guild-avatars").getPublicUrl(path).data.publicUrl;
      }
      if (banner) {
        const ext = banner.name.split(".").pop() ?? "jpg";
        const path = `${gid}/banner.${ext}`;
        const { error: upErr } = await supabase.storage.from("guild-banners").upload(path, banner, { upsert: true, contentType: banner.type });
        if (!upErr) bannerUrl = supabase.storage.from("guild-banners").getPublicUrl(path).data.publicUrl;
      }
      if (avatarUrl || bannerUrl) {
        await supabase.from("guilds").update({ avatar_url: avatarUrl, banner_url: bannerUrl } as never).eq("id", gid);
      }
      // Add leader as member
      await supabase.from("guild_members").insert({ guild_id: gid, user_id: user.id, role: "leader" } as never);
      await supabase.from("user_profiles").update({ guild_id: gid } as never).eq("id", user.id);

      toast.success("Guild created!");
      onCreated();
      nav({ to: "/guilds/$guildId", params: { guildId: gid } });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create guild");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SimpleModal title="Create a Guild" onClose={onClose}>
      {alreadyInGuild ? (
        <p className="text-sm text-muted-foreground">You must leave your current guild before creating a new one.</p>
      ) : inkBalance < 1000 ? (
        <div className="space-y-3">
          <p className="text-sm">You need <span className="font-bold text-primary">1000 Ink</span> to create a guild. You have <span className="font-bold">{inkBalance}</span>.</p>
          <p className="text-xs text-muted-foreground">Open packs and read chapters to earn more.</p>
          <Button asChild className="w-full"><Link to="/packs">Open Packs</Link></Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Guild name</label>
            <Input value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} placeholder="Crimson Wolves" />
            <div className="text-[10px] text-muted-foreground mt-0.5">{name.length}/40 · 2-40 chars</div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 500))}
              rows={3}
              className="w-full rounded-md border border-input bg-transparent p-2 text-sm"
              placeholder="Tell people what your guild is about…"
            />
            <div className="text-[10px] text-muted-foreground mt-0.5">{description.length}/500</div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Join type</label>
            <div className="mt-1 flex gap-2">
              {(["open", "request", "closed"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setJoinType(t)}
                  className={`flex-1 rounded-md border px-2 py-2 text-xs font-medium capitalize ${
                    joinType === t ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground"
                  }`}
                >{t}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Avatar (required)</label>
            <input type="file" accept="image/*" onChange={(e) => setAvatar(e.target.files?.[0] ?? null)} className="block w-full text-xs mt-1" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Banner (optional)</label>
            <input type="file" accept="image/*" onChange={(e) => setBanner(e.target.files?.[0] ?? null)} className="block w-full text-xs mt-1" />
          </div>
          <Button onClick={submit} disabled={!canSubmit} className="w-full">
            {busy ? "Creating…" : "Create Guild — 1000 Ink"}
          </Button>
        </div>
      )}
    </SimpleModal>
  );
}
