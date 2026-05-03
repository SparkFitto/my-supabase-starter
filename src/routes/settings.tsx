import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TARGET_LANGUAGES } from "@/lib/constants";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — RAWL" }, { name: "robots", content: "noindex" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, profile, loading, refreshProfile, signOut } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [lang, setLang] = useState("en");
  const [mode, setMode] = useState("long_strip");
  const [historyPrivate, setHistoryPrivate] = useState(false);
  const [friendsPrivate, setFriendsPrivate] = useState(false);
  const [readingPrivate, setReadingPrivate] = useState(false);
  const [notifyChapters, setNotifyChapters] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [changingPw, setChangingPw] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  useEffect(() => {
    if (!loading && !user) nav({ to: "/signin" });
  }, [loading, user, nav]);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username ?? "");
      setLang(profile.preferred_target_language ?? "en");
      setMode(profile.preferred_reading_mode ?? "long_strip");
      setHistoryPrivate(!!profile.history_is_private);
      setFriendsPrivate(!!profile.friends_are_private);
      setReadingPrivate(!!profile.reading_is_private);
      setNotifyChapters(profile.notify_on_release);
    }
  }, [profile]);

  if (loading || !profile) {
    return <div className="min-h-screen bg-background"><Header /></div>;
  }

  const saveSection = async (patch: Record<string, any>, label: string) => {
    setSaving(true);
    const { error } = await supabase.from("user_profiles").update(patch as never).eq("id", user!.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success(`${label} saved`); refreshProfile(); }
  };

  const saveAccount = async () => {
    const trimmed = username.trim();
    if (!trimmed || !/^[a-zA-Z0-9_]{3,20}$/.test(trimmed)) {
      toast.error("Username must be 3–20 characters: letters, numbers, underscore");
      return;
    }
    if (trimmed.toLowerCase() !== (profile.username ?? "").toLowerCase()) {
      const { data: existing } = await supabase.from("user_profiles").select("id").ilike("username", trimmed).maybeSingle();
      if (existing && existing.id !== user!.id) { toast.error("Username already taken"); return; }
    }
    await saveSection({ username: trimmed }, "Account");
  };

  const changePassword = async () => {
    if (newPassword.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    setChangingPw(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPw(false);
    if (error) toast.error(error.message);
    else { toast.success("Password updated"); setNewPassword(""); }
  };

  const deleteAccount = async () => {
    if (deleteConfirm !== "DELETE") { toast.error('Type "DELETE" to confirm'); return; }
    await supabase.from("user_profiles").update({ banned_at: new Date().toISOString() } as never).eq("id", user!.id);
    await signOut();
    toast.success("Account scheduled for deletion. You've been signed out.");
    nav({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Account, appearance, privacy and reading preferences.</p>
        </div>

        <Tabs defaultValue="account">
          <TabsList className="w-full overflow-x-auto justify-start">
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            <TabsTrigger value="privacy">Privacy</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="reading">Reading</TabsTrigger>
            <TabsTrigger value="danger">Danger</TabsTrigger>
          </TabsList>

          <TabsContent value="account" className="mt-4 space-y-4">
            <Card>
              <CardHeader><CardTitle>Account</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} />
                  <p className="text-[11px] text-muted-foreground">3–20 characters, letters/numbers/underscore.</p>
                </div>
                <Button onClick={saveAccount} disabled={saving}>Save account</Button>
                <div className="border-t border-border pt-4 space-y-2">
                  <Label htmlFor="newpw">Change password</Label>
                  <div className="flex gap-2">
                    <Input id="newpw" type="password" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                    <Button variant="outline" onClick={changePassword} disabled={changingPw || !newPassword}>Update</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appearance" className="mt-4">
            <AppearanceTab profile={profile} userId={user!.id} refreshProfile={refreshProfile} />
          </TabsContent>

          <TabsContent value="privacy" className="mt-4">
            <Card>
              <CardHeader><CardTitle>Privacy</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <ToggleRow label="Make reading history private" description="Hide your reading history from other users." checked={historyPrivate} onChange={(v) => { setHistoryPrivate(v); saveSection({ history_is_private: v }, "Privacy"); }} />
                <ToggleRow label="Make friends list private" description="Hide your friends list from other users." checked={friendsPrivate} onChange={(v) => { setFriendsPrivate(v); saveSection({ friends_are_private: v }, "Privacy"); }} />
                <ToggleRow label="Make reading list private" description="Hide your bookmarks from other users." checked={readingPrivate} onChange={(v) => { setReadingPrivate(v); saveSection({ reading_is_private: v }, "Privacy"); }} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="mt-4">
            <Card>
              <CardHeader><CardTitle>Notifications</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <ToggleRow label="New chapter alerts" description="Get notified when a series in your favorites releases a new chapter." checked={notifyChapters} onChange={(v) => { setNotifyChapters(v); saveSection({ notify_on_release: v }, "Notifications"); }} />
                <p className="text-[11px] text-muted-foreground">All alerts are delivered to your in-app notifications page.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reading" className="mt-4">
            <Card>
              <CardHeader><CardTitle>Reading preferences</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Default target language</Label>
                  <Select value={lang} onValueChange={(v) => { setLang(v); saveSection({ preferred_target_language: v }, "Preferences"); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TARGET_LANGUAGES.map((l) => <SelectItem key={l.code} value={l.code}>{l.flag} {l.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Default reading mode</Label>
                  <Select value={mode} onValueChange={(v) => { setMode(v); saveSection({ preferred_reading_mode: v }, "Preferences"); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="long_strip">Long strip (manhwa)</SelectItem>
                      <SelectItem value="single">Single page</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="danger" className="mt-4">
            <Card className="border-destructive/40">
              <CardHeader><CardTitle className="text-destructive">Danger zone</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">Deleting your account will permanently remove your profile and sign you out. Type <code className="font-mono px-1 rounded bg-secondary">DELETE</code> below to confirm.</p>
                <div className="flex gap-2">
                  <Input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder='Type "DELETE"' />
                  <Button variant="destructive" onClick={deleteAccount} disabled={deleteConfirm !== "DELETE"}>Delete account</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end pt-4">
          <Button variant="ghost" onClick={() => signOut().then(() => nav({ to: "/" }))}>Sign out</Button>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border p-3 gap-3">
      <div className="min-w-0">
        <Label>{label}</Label>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function AppearanceTab({ profile, userId, refreshProfile }: { profile: any; userId: string; refreshProfile: () => void }) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState<string | null>(null);

  const { data: purchases = [] } = useQuery({
    queryKey: ["my_purchases_with_items", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_purchases")
        .select("id,item_id,is_equipped,shop_items(id,name,image_url,category)")
        .eq("user_id", userId);
      return data ?? [];
    },
  });

  const upload = async (bucket: string, file: File, field: "avatar_url" | "banner_url") => {
    setUploading(field);
    const path = `${userId}/${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
    const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (upErr) { setUploading(null); toast.error(upErr.message); return; }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    const patch: any = { [field]: data.publicUrl };
    if (field === "avatar_url") patch.equipped_avatar_item_id = null;
    if (field === "banner_url") patch.equipped_banner_item_id = null;
    const { error } = await supabase.from("user_profiles").update(patch as never).eq("id", userId);
    setUploading(null);
    if (error) toast.error(error.message);
    else { toast.success("Saved"); refreshProfile(); }
  };

  const equipShopItem = async (item: any) => {
    const col = `equipped_${item.category}_item_id`;
    const patch: any = { [col]: item.id };
    if (item.category === "avatar") patch.avatar_url = item.image_url;
    if (item.category === "banner") patch.banner_url = item.image_url;
    await supabase.from("user_purchases").update({ is_equipped: false } as never).eq("user_id", userId);
    await supabase.from("user_purchases").update({ is_equipped: true } as never).eq("user_id", userId).eq("item_id", item.id);
    const { error } = await supabase.from("user_profiles").update(patch as never).eq("id", userId);
    if (error) toast.error(error.message);
    else { toast.success("Equipped"); refreshProfile(); qc.invalidateQueries({ queryKey: ["my_purchases_with_items", userId] }); }
  };

  const purchasesByCat = (cat: string) => purchases.filter((p: any) => p.shop_items?.category === cat);

  return (
    <Card>
      <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
      <CardContent>
        <Tabs defaultValue="avatar">
          <TabsList>
            <TabsTrigger value="avatar">Avatar</TabsTrigger>
            <TabsTrigger value="banner">Banner</TabsTrigger>
            <TabsTrigger value="frame">Frame</TabsTrigger>
          </TabsList>

          <TabsContent value="avatar" className="mt-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-20 w-20 rounded-full bg-muted overflow-hidden">
                {profile.avatar_url && <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="space-y-2">
                <Label>Upload custom avatar</Label>
                <input type="file" accept="image/*" className="text-sm" onChange={(e) => e.target.files?.[0] && upload("avatars", e.target.files[0], "avatar_url")} />
                {uploading === "avatar_url" && <p className="text-xs text-muted-foreground">Uploading…</p>}
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold mb-2">From Shop</div>
              {purchasesByCat("avatar").length === 0 ? (
                <p className="text-xs text-muted-foreground">No avatars purchased. <a href="/shop" className="text-primary underline">Browse shop →</a></p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {purchasesByCat("avatar").map((p: any) => (
                    <button key={p.id} onClick={() => equipShopItem(p.shop_items)} className="relative rounded-lg border border-border overflow-hidden aspect-square hover:border-primary">
                      <img src={p.shop_items.image_url} alt="" className="h-full w-full object-cover" />
                      {p.is_equipped && <span className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5"><Check className="h-3 w-3" /></span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="banner" className="mt-4 space-y-4">
            <div className="space-y-2">
              <div className="aspect-[16/5] w-full rounded bg-muted overflow-hidden">
                {profile.banner_url && <img src={profile.banner_url} alt="" className="h-full w-full object-cover" />}
              </div>
              <Label>Upload custom banner</Label>
              <input type="file" accept="image/*" className="text-sm" onChange={(e) => e.target.files?.[0] && upload("banners", e.target.files[0], "banner_url")} />
              {uploading === "banner_url" && <p className="text-xs text-muted-foreground">Uploading…</p>}
            </div>
            <div>
              <div className="text-sm font-semibold mb-2">From Shop</div>
              {purchasesByCat("banner").length === 0 ? (
                <p className="text-xs text-muted-foreground">No banners purchased.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {purchasesByCat("banner").map((p: any) => (
                    <button key={p.id} onClick={() => equipShopItem(p.shop_items)} className="relative rounded-lg border border-border overflow-hidden aspect-[16/5] hover:border-primary">
                      <img src={p.shop_items.image_url} alt="" className="h-full w-full object-cover" />
                      {p.is_equipped && <span className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5"><Check className="h-3 w-3" /></span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="frame" className="mt-4">
            {purchasesByCat("frame").length === 0 ? (
              <p className="text-xs text-muted-foreground">No frames purchased. <a href="/shop" className="text-primary underline">Browse shop →</a></p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {purchasesByCat("frame").map((p: any) => (
                  <button key={p.id} onClick={() => equipShopItem(p.shop_items)} className="relative rounded-lg border border-border overflow-hidden aspect-square hover:border-primary">
                    <img src={p.shop_items.image_url} alt="" className="h-full w-full object-cover" />
                    {p.is_equipped && <span className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5"><Check className="h-3 w-3" /></span>}
                  </button>
                ))}
              </div>
            )}
          </TabsContent>

        </Tabs>
      </CardContent>
    </Card>
  );
}
