import { useRef, useState } from "react";
import { Plus, Upload, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CARD_RANKS } from "@/components/cards/CardDisplay";
import { toast } from "sonner";

export function CardSubmitButton({ seriesId, seriesTitle }: { seriesId?: string | null; seriesTitle?: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [characterName, setCharacterName] = useState("");
  const [rank, setRank] = useState("C");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [tags, setTags] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!user) return null;

  const onPickFile = (f: File | null) => {
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const submit = async () => {
    if (!characterName.trim()) return toast.error("Please enter a character name");
    if (!file) return toast.error("Please choose a card image");
    setSubmitting(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("card-images").upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("card-images").getPublicUrl(path);
      const { error: insErr } = await supabase.from("cards").insert({
        name: characterName.trim(), character_name: characterName.trim(), image_url: pub.publicUrl,
        rank, tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        series_id: seriesId ?? null, submitted_by: user.id, is_approved: false,
      });
      if (insErr) throw insErr;
      toast.success("Card submitted! A moderator will review it shortly.");
      setOpen(false);
      setCharacterName(""); setRank("C"); onPickFile(null); setTags("");
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
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Submit a card{seriesTitle ? ` for ${seriesTitle}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            {/* Big image picker / preview area */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Card image *
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="group relative flex aspect-[2/3] w-40 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-secondary/40 transition hover:border-primary"
              >
                {preview ? (
                  <>
                    <img src={preview} alt="" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition group-hover:opacity-100">
                      <span className="text-xs font-bold text-white">Change image</span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                    <Upload className="h-6 w-6" />
                    <span className="text-xs font-medium">Tap to choose image</span>
                    <span className="text-[10px]">PNG, JPG, WebP</span>
                  </div>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Character name *</label>
              <input value={characterName} onChange={(e) => setCharacterName(e.target.value)} placeholder="e.g. Sung Jin-Woo" className="w-full rounded border border-border bg-background px-3 py-2" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rank</label>
                <select value={rank} onChange={(e) => setRank(e.target.value)} className="w-full rounded border border-border bg-background px-3 py-2">
                  {CARD_RANKS.map((r) => <option key={r} value={r}>Rank {r}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tags</label>
                <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="hero, sword, hunter" className="w-full rounded border border-border bg-background px-3 py-2" />
              </div>
            </div>

            <p className="flex items-start gap-1.5 rounded-md bg-secondary/50 p-2 text-xs text-muted-foreground">
              <ImageIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>Cards go through moderator review before appearing in the catalog. You'll get a notification when yours is approved or rejected.</span>
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={submit} disabled={submitting}>{submitting ? "Submitting…" : "Submit for review"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
