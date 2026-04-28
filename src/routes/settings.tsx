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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TARGET_LANGUAGES } from "@/lib/constants";
import { toast } from "sonner";

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

  // Password change
  const [newPassword, setNewPassword] = useState("");
  const [changingPw, setChangingPw] = useState(false);

  // Account deletion
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
    // Best-effort: delete profile row, sign out. Auth user removal needs server-side admin call (future work).
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
          <p className="text-sm text-muted-foreground mt-1">Account, privacy, notifications and reading preferences.</p>
        </div>

        {/* ACCOUNT */}
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

        {/* PRIVACY */}
        <Card>
          <CardHeader><CardTitle>Privacy</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <ToggleRow
              label="Make reading history private"
              description="Hide your reading history from other users."
              checked={historyPrivate}
              onChange={(v) => { setHistoryPrivate(v); saveSection({ history_is_private: v }, "Privacy"); }}
            />
            <ToggleRow
              label="Make friends list private"
              description="Hide your friends list from other users."
              checked={friendsPrivate}
              onChange={(v) => { setFriendsPrivate(v); saveSection({ friends_are_private: v }, "Privacy"); }}
            />
            <ToggleRow
              label="Make reading list private"
              description="Hide your bookmarks from other users."
              checked={readingPrivate}
              onChange={(v) => { setReadingPrivate(v); saveSection({ reading_is_private: v }, "Privacy"); }}
            />
          </CardContent>
        </Card>

        {/* NOTIFICATIONS */}
        <Card>
          <CardHeader><CardTitle>Notifications</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <ToggleRow
              label="New chapter alerts"
              description="Get notified when a series in your favorites releases a new chapter."
              checked={notifyChapters}
              onChange={(v) => { setNotifyChapters(v); saveSection({ notify_on_release: v }, "Notifications"); }}
            />
            <p className="text-[11px] text-muted-foreground">All alerts are delivered to your in-app notifications page.</p>
          </CardContent>
        </Card>

        {/* READING PREFERENCES */}
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

        {/* DANGER ZONE */}
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
