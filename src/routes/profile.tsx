import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TARGET_LANGUAGES } from "@/lib/constants";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Your profile — RAWL" }, { name: "robots", content: "noindex" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, loading, refreshProfile, signOut } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [lang, setLang] = useState("en");
  const [mode, setMode] = useState("long_strip");
  
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/signin" });
  }, [loading, user, nav]);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username ?? "");
      setLang(profile.preferred_target_language ?? "en");
      setMode(profile.preferred_reading_mode ?? "long_strip");
      
    }
  }, [profile]);

  const save = async () => {
    if (!user) return;
    setSaving(true); setMsg(null);
    const { error } = await supabase
      .from("user_profiles")
      .update({
        username,
        preferred_target_language: lang,
        preferred_reading_mode: mode,
        
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) setMsg(error.message);
    else { setMsg("Saved!"); await refreshProfile(); }
  };

  if (loading || !profile) return <div className="min-h-screen bg-background"><Header /></div>;

  const used = profile.weekly_chapters_used;
  const cap = profile.plan === "free" ? 3 : profile.plan === "pro" ? 50 : Infinity;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
        <div>
          <h1 className="text-3xl font-bold">@{profile.username ?? "you"}</h1>
          <p className="text-xs uppercase tracking-wide text-primary font-bold mt-1">{profile.plan}</p>
        </div>

        <Card>
          <CardHeader><CardTitle>Plan & usage</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md bg-muted p-4">
              <p className="font-mono text-xs uppercase text-muted-foreground">Current plan</p>
              <p className="text-lg font-semibold capitalize">{profile.plan}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              <span className="font-mono text-foreground">{used}</span> / {cap === Infinity ? "∞" : cap} chapters this week ·
              <span className="ml-1 font-mono">{profile.chapters_translated_total}</span> total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Preferences</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Default target language</Label>
              <Select value={lang} onValueChange={setLang}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TARGET_LANGUAGES.map((l) => <SelectItem key={l.code} value={l.code}>{l.flag} {l.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Default reading mode</Label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="long_strip">Long strip (manhwa)</SelectItem>
                  <SelectItem value="single">Single page</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              New-chapter alerts are delivered through your <Link to="/notifications" className="text-primary hover:underline">notifications page</Link> for any series you favorite.
            </p>
            {msg && <p className={`text-sm ${msg === "Saved!" ? "text-success" : "text-destructive"}`}>{msg}</p>}
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => signOut().then(() => nav({ to: "/" }))}>Sign out</Button>
              <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save preferences"}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
