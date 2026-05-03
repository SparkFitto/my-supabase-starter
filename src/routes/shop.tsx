import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { SwipeTabs } from "@/components/ui/swipe-tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Check } from "lucide-react";

export const Route = createFileRoute("/shop")({
  head: () => ({ meta: [{ title: "Shop — RAWL" }] }),
  component: ShopPage,
});

const CATEGORIES = [
  { key: "avatar", label: "Avatars" },
  { key: "frame", label: "Frames" },
  { key: "banner", label: "Banners" },
  { key: "skin", label: "Skins" },
] as const;

function ShopPage() {
  const { user, profile, refreshProfile } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<string>("avatar");

  const { data: items, isLoading } = useQuery({
    queryKey: ["shop_items", tab],
    queryFn: async () => {
      const { data } = await supabase
        .from("shop_items")
        .select("*")
        .eq("category", tab)
        .eq("is_active", true)
        .order("sort_order");
      return data ?? [];
    },
  });

  const { data: owned } = useQuery({
    queryKey: ["user_purchases", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_purchases")
        .select("id,item_id,is_equipped")
        .eq("user_id", user!.id);
      return data ?? [];
    },
  });

  const ownedMap = new Map((owned ?? []).map((p) => [p.item_id, p]));

  const buy = async (item: any) => {
    if (!user) {
      toast.error("Sign in to purchase");
      return;
    }
    if ((profile?.ink_balance ?? 0) < item.price_ink) {
      toast.error("Not enough Ink. Top up →", {
        action: { label: "Top up", onClick: () => (window.location.href = "/topup") },
      });
      return;
    }
    const { error: spendErr } = await supabase.rpc("spend_ink" as any, {
      _amount: item.price_ink,
      _source: `shop:${item.category}`,
    });
    if (spendErr) {
      toast.error(spendErr.message);
      return;
    }
    const { error: insErr } = await supabase.from("user_purchases").insert({
      user_id: user.id,
      item_id: item.id,
      ink_spent: item.price_ink,
    } as never);
    if (insErr) {
      toast.error(insErr.message);
      return;
    }
    toast.success("Purchased! Equip in Settings → Appearance.");
    refreshProfile();
    qc.invalidateQueries({ queryKey: ["user_purchases", user.id] });
  };

  const equip = async (item: any) => {
    if (!user) return;
    const col = `equipped_${item.category}_item_id`;
    await supabase
      .from("user_purchases")
      .update({ is_equipped: false } as never)
      .eq("user_id", user.id);
    await supabase
      .from("user_purchases")
      .update({ is_equipped: true } as never)
      .eq("user_id", user.id)
      .eq("item_id", item.id);
    await supabase.from("user_profiles").update({ [col]: item.id } as never).eq("id", user.id);
    toast.success("Equipped!");
    refreshProfile();
    qc.invalidateQueries({ queryKey: ["user_purchases", user.id] });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Shop</h1>
          {user && (
            <div className="text-sm">
              🖊️ <span className="font-bold">{profile?.ink_balance ?? 0}</span> Ink
            </div>
          )}
        </div>

        <SwipeTabs tabs={CATEGORIES.map((c) => ({ key: c.key, label: c.label }))} value={tab} onValueChange={setTab}>
          {CATEGORIES.map((c) => (
            <div key={c.key}>
              {c.key !== tab ? null : isLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[...Array(6)].map((_, i) => (
                    <Skeleton key={i} className="h-56" />
                  ))}
                </div>
              ) : !items?.length ? (
                <div className="rounded-lg border border-border bg-card p-10 text-center">
                  <p className="text-sm text-muted-foreground">
                    No items yet. Check back soon — admins are adding new ones!
                  </p>
                  <Button asChild variant="outline" size="sm" className="mt-3">
                    <Link to="/cards">Browse Cards</Link>
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {items.map((item: any) => {
                    const ownedRow = ownedMap.get(item.id);
                    const isOwned = !!ownedRow;
                    const isEquipped = ownedRow?.is_equipped;
                    return (
                      <div
                        key={item.id}
                        className="rounded-lg border border-border bg-card overflow-hidden flex flex-col"
                      >
                        <div className={c.key === "banner" ? "aspect-[16/6] bg-muted" : "aspect-square bg-muted"}>
                          <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                        </div>
                        <div className="p-3 flex-1 flex flex-col">
                          <div className="font-semibold text-sm truncate">{item.name}</div>
                          <div className="mt-1 text-xs flex items-center gap-2">
                            {item.original_price_ink && (
                              <span className="line-through text-muted-foreground">
                                {item.original_price_ink}
                              </span>
                            )}
                            <span className="text-primary font-bold">{item.price_ink} 🖊️</span>
                          </div>
                          <div className="mt-2">
                            {isEquipped ? (
                              <Button size="sm" variant="outline" className="w-full" disabled>
                                <Check className="h-3 w-3 mr-1" /> Equipped
                              </Button>
                            ) : isOwned ? (
                              <Button size="sm" variant="outline" className="w-full" onClick={() => equip(item)}>
                                Equip
                              </Button>
                            ) : (
                              <Button size="sm" className="w-full" onClick={() => buy(item)}>
                                Buy — {item.price_ink} 🖊️
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </SwipeTabs>
      </div>
    </div>
  );
}
