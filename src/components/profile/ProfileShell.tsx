import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Camera, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function initials(name: string | null | undefined) {
  return (name ?? "?").slice(0, 2).toUpperCase();
}

function lastSeenLabel(lastSeen: string | null | undefined) {
  if (!lastSeen) return "Offline";
  const ms = Date.now() - new Date(lastSeen).getTime();
  if (ms < 5 * 60 * 1000) return "Online now";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `Last seen ${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Last seen ${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  return `Last seen ${days} day${days === 1 ? "" : "s"} ago`;
}

export function ProfileShell({
  profile,
  isOwn,
  onProfileUpdated,
  rightActions,
  activeTab,
  onTabChange,
  children,
}: {
  profile: {
    id: string;
    username: string | null;
    avatar_url: string | null;
    banner_url?: string | null;
    plan: string;
    last_seen?: string | null;
  };
  isOwn: boolean;
  onProfileUpdated?: () => void;
  rightActions?: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  children: ReactNode;
}) {
  const isOnline =
    !!profile.last_seen && Date.now() - new Date(profile.last_seen).getTime() < 5 * 60 * 1000;

  const bannerInputRef = useRef<HTMLInputElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handleUpload = async (
    file: File,
    bucket: "banners" | "avatars",
    column: "banner_url" | "avatar_url",
    setBusy: (b: boolean) => void,
  ) => {
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${profile.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
      const update: Record<string, string> = { [column]: pub.publicUrl };
      const { error: updErr } = await supabase
        .from("user_profiles")
        .update(update as never)
        .eq("id", profile.id);
      if (updErr) throw updErr;
      toast.success(`${column === "banner_url" ? "Banner" : "Avatar"} updated`);
      onProfileUpdated?.();
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const tabs = [
    { id: "profile", label: "Profile" },
    { id: "bookmarks", label: "Bookmarks" },
    { id: "social", label: "Social" },
  ];

  return (
    <div>
      {/* BANNER */}
      <div className="relative h-[180px] sm:h-[220px] w-full overflow-hidden rounded-b-lg">
        {profile.banner_url ? (
          <img src={profile.banner_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background:
                "linear-gradient(135deg, hsl(180 40% 18%), hsl(265 40% 22%), hsl(220 50% 22%), hsl(180 40% 18%))",
              backgroundSize: "300% 300%",
              animation: "rawl-banner-shift 18s ease infinite",
            }}
          />
        )}
        <style>{`@keyframes rawl-banner-shift { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }`}</style>
        {isOwn && (
          <>
            <button
              type="button"
              onClick={() => bannerInputRef.current?.click()}
              disabled={uploadingBanner}
              className="absolute top-3 right-3 h-8 w-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition"
              aria-label="Change banner"
            >
              <Camera className="h-4 w-4" />
            </button>
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f, "banners", "banner_url", setUploadingBanner);
                e.target.value = "";
              }}
            />
          </>
        )}
      </div>

      {/* AVATAR + HEADER ROW */}
      <div className="px-4 sm:px-6 -mt-[45px] flex items-end gap-4 flex-wrap">
        <div className="relative">
          <div
            onClick={isOwn ? () => avatarInputRef.current?.click() : undefined}
            className={`relative h-[90px] w-[90px] rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold overflow-hidden ring-4 ring-background shadow-xl ${isOwn ? "cursor-pointer group" : ""}`}
          >
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              initials(profile.username)
            )}
            {isOwn && (
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                <Camera className="h-5 w-5 text-white" />
              </div>
            )}
            <span
              className={`absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full border-2 border-background ${isOnline ? "bg-success" : "bg-muted-foreground"}`}
              title={lastSeenLabel(profile.last_seen)}
            />
          </div>
          {isOwn && (
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f, "avatars", "avatar_url", setUploadingAvatar);
                e.target.value = "";
              }}
            />
          )}
        </div>

        <div className="flex-1 min-w-0 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold truncate">@{profile.username ?? "you"}</h1>
            <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold uppercase tracking-wide">
              {profile.plan}
            </span>
          </div>
          <p className={`text-xs mt-0.5 ${isOnline ? "text-success" : "text-muted-foreground"}`}>
            {lastSeenLabel(profile.last_seen)}
          </p>
        </div>

        {rightActions && <div className="mb-2">{rightActions}</div>}
      </div>

      {/* TABS */}
      <div className="mt-4 border-b border-border px-4 sm:px-6">
        <div className="flex gap-6 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              className={`py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* CONTENT */}
      <div className="px-4 sm:px-6 py-6">{children}</div>
    </div>
  );
}

// Reusable section card
export function SectionCard({
  title,
  more,
  children,
  action,
}: {
  title: string;
  more?: { label: string; to: string };
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
          {title}
        </h3>
        {more ? (
          <Link to={more.to as any} className="text-xs text-primary hover:underline">
            {more.label} →
          </Link>
        ) : action}
      </div>
      {children}
    </section>
  );
}

// Chapters-read milestones bar
export function ChaptersReadBar({ count }: { count: number }) {
  const milestones = [100, 500, 2000, 5000, 10000];
  const max = milestones[milestones.length - 1];
  const pct = Math.min(100, (count / max) * 100);
  return (
    <div>
      <div className="relative h-2 rounded-full bg-secondary">
        <div className="absolute left-0 top-0 h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        <div className="absolute inset-0 flex justify-between items-center px-0">
          {milestones.map((m) => {
            const reached = count >= m;
            const left = (m / max) * 100;
            return (
              <div
                key={m}
                style={{ left: `${left}%` }}
                className="absolute -translate-x-1/2 flex flex-col items-center"
              >
                <span className={`block h-3 w-3 rounded-full border-2 ${reached ? "bg-primary border-primary" : "bg-background border-border"}`} />
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-4 flex justify-between text-[10px] text-muted-foreground font-mono">
        {milestones.map((m) => (
          <span key={m}>{m.toLocaleString()}</span>
        ))}
      </div>
      <p className="mt-2 text-sm font-semibold">{count.toLocaleString()} chapters read</p>
    </div>
  );
}

export function EditableBio({
  bio,
  isOwn,
  userId,
  onSaved,
}: {
  bio: string | null | undefined;
  isOwn: boolean;
  userId: string;
  onSaved?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(bio ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setVal(bio ?? "");
  }, [bio]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("user_profiles")
      .update({ bio: val.slice(0, 300) })
      .eq("id", userId);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Bio updated");
      setEditing(false);
      onSaved?.();
    }
  };

  if (editing) {
    return (
      <div>
        <textarea
          value={val}
          onChange={(e) => setVal(e.target.value.slice(0, 300))}
          rows={3}
          className="w-full rounded-md border border-input bg-transparent p-2 text-sm"
          placeholder="Tell others about yourself…"
        />
        <div className="mt-2 flex justify-between items-center">
          <span className="text-xs text-muted-foreground">{val.length}/300</span>
          <div className="flex gap-2">
            <button onClick={() => { setEditing(false); setVal(bio ?? ""); }} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
            <button onClick={save} disabled={saving} className="text-xs font-medium text-primary hover:underline disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!bio) {
    if (isOwn) {
      return (
        <button onClick={() => setEditing(true)} className="text-sm text-muted-foreground italic hover:text-foreground flex items-center gap-2">
          Tell others about yourself…
          <Pencil className="h-3 w-3" />
        </button>
      );
    }
    return <p className="text-sm text-muted-foreground italic">User hasn't written anything yet.</p>;
  }

  return (
    <div className="flex items-start gap-2">
      <p className="text-sm whitespace-pre-wrap break-words flex-1">{bio}</p>
      {isOwn && (
        <button onClick={() => setEditing(true)} className="p-1 text-muted-foreground hover:text-foreground" aria-label="Edit bio">
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
