import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/updates")({
  component: AdminUpdates;
});

function AdminUpdates() {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState("new");
  const [saving, setSaving] = useState(false);

  const { data: updates, refetch } = useQuery({
    queryKey: ["admin-updates-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_updates")
        .select("*")
        .order("published_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const publish = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error("Title and body required");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("site_updates").insert({
      title: title.trim(),
      body: body.trim(),
      type,
      created_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Published");
      setTitle(""); setBody(""); setType("new");
      refetch();
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this update?")) return;
    const { error } = await supabase.from("site_updates").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); refetch(); }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Site Updates</h1>

      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h2 className="font-medium">Publish a new update</h2>
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea
          placeholder="Body (Markdown supported)"
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="improvement">Improvement</SelectItem>
              <SelectItem value="fix">Fix</SelectItem>
              <SelectItem value="announcement">Announcement</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={publish} disabled={saving}>
            {saving ? "Publishing…" : "Publish"}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {updates?.map((u) => (
          <div key={u.id} className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{u.type}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(u.published_at).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 font-medium">{u.title}</p>
                <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
                  {u.body}
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove(u.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
        {!updates?.length && (
          <p className="py-8 text-center text-sm text-muted-foreground">No updates yet.</p>
        )}
      </div>
    </div>
  );
}
