import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";

export const Route = createFileRoute("/admin/shop")({
  component: AdminShop,
});

const CATEGORIES = ["avatar", "frame", "banner", "skin", "status"] as const;

type ItemDraft = {
  id?: string;
  category: string;
  name: string;
  description: string;
  image_url: string;
  price_ink: number;
  original_price_ink: number | null;
  is_active: boolean;
  sort_order: number;
};

function emptyDraft(): ItemDraft {
  return {
    category: "avatar",
    name: "",
    description: "",
    image_url: "",
    price_ink: 0,
    original_price_ink: null,
    is_active: true,
    sort_order: 0,
  };
}

function AdminShop() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ItemDraft>(emptyDraft());
  const [uploading, setUploading] = useState(false);

  const { data: items = [] } = useQuery({
    queryKey: ["admin_shop_items"],
    queryFn: async () => {
      const { data } = await supabase.from("shop_items").select("*").order("category").order("sort_order");
      return data ?? [];
    },
  });

  const { data: packages = [] } = useQuery({
    queryKey: ["admin_ink_packages"],
    queryFn: async () => {
      const { data } = await supabase.from("ink_packages").select("*").order("sort_order");
      return data ?? [];
    },
  });

  const handleFile = async (file: File) => {
    setUploading(true);
    const path = `${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
    const { error } = await supabase.storage.from("shop-items").upload(path, file);
    setUploading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const { data } = supabase.storage.from("shop-items").getPublicUrl(path);
    setDraft((d) => ({ ...d, image_url: data.publicUrl }));
  };

  const saveItem = async () => {
    if (!draft.name || !draft.image_url) {
      toast.error("Name and image required");
      return;
    }
    if (draft.id) {
      const { error } = await supabase
        .from("shop_items")
        .update({
          category: draft.category,
          name: draft.name,
          description: draft.description,
          image_url: draft.image_url,
          price_ink: draft.price_ink,
          original_price_ink: draft.original_price_ink,
          is_active: draft.is_active,
          sort_order: draft.sort_order,
        } as never)
        .eq("id", draft.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("shop_items").insert({
        category: draft.category,
        name: draft.name,
        description: draft.description,
        image_url: draft.image_url,
        price_ink: draft.price_ink,
        original_price_ink: draft.original_price_ink,
        is_active: draft.is_active,
        sort_order: draft.sort_order,
      } as never);
      if (error) return toast.error(error.message);
    }
    toast.success("Saved");
    setOpen(false);
    setDraft(emptyDraft());
    qc.invalidateQueries({ queryKey: ["admin_shop_items"] });
  };

  const removeItem = async (id: string) => {
    if (!confirm("Delete this item? Users who purchased it keep theirs.")) return;
    const { error } = await supabase.from("shop_items").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin_shop_items"] });
    }
  };

  const updatePackage = async (id: string, patch: Record<string, any>) => {
    const { error } = await supabase.from("ink_packages").update(patch as never).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["admin_ink_packages"] });
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Shop Management</h1>
      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="packages">Packages</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setDraft(emptyDraft());
                setOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" /> Add Item
            </Button>
          </div>
          <div className="space-y-2">
            {items.map((it: any) => (
              <div
                key={it.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
              >
                <div className="h-12 w-12 shrink-0 rounded bg-muted overflow-hidden">
                  <img src={it.image_url} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{it.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {it.category} · {it.price_ink} 🖊️ · {it.is_active ? "active" : "inactive"}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => { setDraft(it); setOpen(true); }}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => removeItem(it.id)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
            {!items.length && (
              <p className="text-sm text-muted-foreground py-8 text-center">No items yet.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="packages" className="mt-4 space-y-2">
          {packages.map((p: any) => (
            <div key={p.id} className="rounded-lg border border-border bg-card p-3 grid grid-cols-2 sm:grid-cols-6 gap-2 items-center">
              <Input
                type="number"
                value={p.ink_amount}
                onChange={(e) => updatePackage(p.id, { ink_amount: Number(e.target.value) })}
              />
              <Input
                type="number"
                step="0.01"
                value={p.price_usd}
                onChange={(e) => updatePackage(p.id, { price_usd: Number(e.target.value) })}
              />
              <Input
                type="number"
                value={p.bonus_percent}
                onChange={(e) => updatePackage(p.id, { bonus_percent: Number(e.target.value) })}
              />
              <Input
                type="number"
                value={p.sort_order}
                onChange={(e) => updatePackage(p.id, { sort_order: Number(e.target.value) })}
              />
              <label className="flex items-center gap-1 text-xs">
                <Switch
                  checked={p.is_popular}
                  onCheckedChange={(v) => updatePackage(p.id, { is_popular: v })}
                />
                Popular
              </label>
              <label className="flex items-center gap-1 text-xs">
                <Switch
                  checked={p.is_active}
                  onCheckedChange={(v) => updatePackage(p.id, { is_active: v })}
                />
                Active
              </label>
            </div>
          ))}
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Edit Item" : "Add Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Category</Label>
              <Select value={draft.category} onValueChange={(v) => setDraft((d) => ({ ...d, category: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Name</Label>
              <Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              />
            </div>
            <div>
              <Label>Image</Label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                className="text-sm"
              />
              {draft.image_url && (
                <img src={draft.image_url} alt="" className="mt-2 h-24 w-24 object-cover rounded border" />
              )}
              {uploading && <p className="text-xs text-muted-foreground">Uploading…</p>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Price (Ink)</Label>
                <Input
                  type="number"
                  value={draft.price_ink}
                  onChange={(e) => setDraft((d) => ({ ...d, price_ink: Number(e.target.value) }))}
                />
              </div>
              <div>
                <Label>Original price</Label>
                <Input
                  type="number"
                  value={draft.original_price_ink ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      original_price_ink: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Sort order</Label>
                <Input
                  type="number"
                  value={draft.sort_order}
                  onChange={(e) => setDraft((d) => ({ ...d, sort_order: Number(e.target.value) }))}
                />
              </div>
              <label className="flex items-end gap-2 pb-2">
                <Switch
                  checked={draft.is_active}
                  onCheckedChange={(v) => setDraft((d) => ({ ...d, is_active: v }))}
                />
                Active
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveItem}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
