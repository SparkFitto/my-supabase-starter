import { useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CARD_RANKS } from "@/components/cards/CardDisplay";
import { toast } from "sonner";

export function CardSubmitButton({ seriesId, seriesTitle }: { seriesId?: string | null; seriesTitle?: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [characterName, setCharacterName] = useState("");
  const [rank, setRank] = useState("C");
  const [file, setFile] = useState<File | null>(null);
  const [tags, setTags] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!user) return null;

  const submit = async () => {
    if (!name.trim() || !characterName.trim() || !file) {
      toast.error("Fill all fields and pick an image");
      return;
    }
    setSubmitting(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("card-images").upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("card-images").getPublicUrl(path);
      const { error: insErr } = await supabase.from("cards").insert({
        name: name.trim(), character_name: characterName.trim(), image_url: pub.publicUrl,
        rank, tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        series_id: seriesId ?? null, submitted_by: user.id, is_approved: false,
      });
      if (insErr) throw insErr;
      toast.success("Card submitted for review!");
      setOpen(false);
      setName(""); setCharacterName(""); setRank("C"); setFile(null); setTags("");
    } catch (e: any) {
      toast.error(e.message ?? "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 h-4 w-4" />Submit Card
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit a card{seriesTitle ? ` for ${seriesTitle}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <input value={characterName} onChange={(e) => setCharacterName(e.target.value)} placeholder="Character name *" className="w-full rounded border border-border bg-background px-3 py-2" />
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Card name (e.g. 'Battle Form') *" className="w-full rounded border border-border bg-background px-3 py-2" />
            <select value={rank} onChange={(e) => setRank(e.target.value)} className="w-full rounded border border-border bg-background px-3 py-2">
              {CARD_RANKS.map((r) => <option key={r} value={r}>Rank {r}</option>)}
            </select>
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags (comma-separated)" className="w-full rounded border border-border bg-background px-3 py-2" />
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="w-full text-xs" />
            <p className="text-xs text-muted-foreground">Cards are reviewed by moderators before appearing in the catalog.</p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={submit} disabled={submitting}>{submitting ? "Submitting…" : "Submit"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
