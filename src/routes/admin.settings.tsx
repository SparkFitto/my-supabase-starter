import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Pencil } from "lucide-react";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettings,
});

const FEATURE_KEYS = [
  "cards_system_enabled",
  "guild_system_enabled",
  "marketplace_enabled",
  "shop_enabled",
];

const GROUPS: Record<string, string[]> = {
  "Pack costs & pity": ["pack_cost_ink", "pack_cost_ten_ink", "s_pity_threshold", "x_pity_threshold"],
  "Daily rewards": [
    "daily_login_ink",
    "daily_login_ink_pro",
    "read_ink_per_5pages",
    "read_ink_daily_max_times",
    "comment_ink",
    "comment_ink_daily_max",
    "comment_ink_daily_max_pro",
  ],
  Translation: [
    "translate_ink",
    "translate_ink_daily_max",
    "free_translations_lifetime",
    "free_translations_pro_monthly",
    "translation_cost_ink",
  ],
  Marketplace: ["lot_max_free", "lot_max_pro"],
  "Decks & cards": ["deck_free_slots", "deck_free_slots_pro", "split_free_daily_pro", "split_extra_cost"],
  Limits: ["wishlist_max_free", "wishlist_max_pro", "blocklist_max_free", "blocklist_max_pro"],
  Guild: [
    "guild_create_cost",
    "guild_war_duration_days",
    "guild_level_1_max_members",
    "guild_level_2_max_members",
    "guild_level_3_max_members",
    "guild_level_4_max_members",
    "guild_level_5_max_members",
    "guild_level_6_max_members",
    "guild_level_7_plus_max_members",
  ],
};

function AdminSettings() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const { data: settings = [] } = useQuery({
    queryKey: ["platform_settings"],
    queryFn: async () => {
      const { data } = await supabase.from("platform_settings").select("*").order("key");
      return data ?? [];
    },
  });

  const settingsMap = new Map(settings.map((s: any) => [s.key, s]));

  const save = async (key: string, value: string) => {
    const { error } = await supabase
      .from("platform_settings")
      .update({ value, updated_at: new Date().toISOString() } as never)
      .eq("key", key);
    if (error) toast.error(error.message);
    else {
      toast.success("Saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["platform_settings"] });
      qc.invalidateQueries({ queryKey: ["platform_setting", key] });
    }
  };

  const economySettings = settings.filter((s: any) => !FEATURE_KEYS.includes(s.key));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Platform Settings</h1>
      <Tabs defaultValue="economy">
        <TabsList>
          <TabsTrigger value="economy">Economy</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
        </TabsList>

        <TabsContent value="economy" className="mt-4 space-y-6">
          {Object.entries(GROUPS).map(([group, keys]) => (
            <div key={group}>
              <h2 className="text-sm font-semibold uppercase text-muted-foreground mb-2">{group}</h2>
              <div className="rounded-lg border border-border bg-card divide-y divide-border">
                {keys.map((key) => {
                  const s: any = settingsMap.get(key);
                  if (!s) return null;
                  const isEditing = editing === key;
                  return (
                    <div key={key} className="flex items-center gap-3 p-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{s.description}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">{key}</div>
                      </div>
                      {isEditing ? (
                        <>
                          <Input
                            className="w-32 h-8"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                          />
                          <Button size="sm" onClick={() => save(key, draft)}>
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="font-mono text-sm font-bold w-20 text-right">{s.value}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditing(key);
                              setDraft(s.value);
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {economySettings.filter((s: any) => !Object.values(GROUPS).flat().includes(s.key)).map((s: any) => (
            <div key={s.key} className="text-xs text-muted-foreground">
              (Ungrouped: {s.key} = {s.value})
            </div>
          ))}
        </TabsContent>

        <TabsContent value="features" className="mt-4">
          <div className="rounded-lg border border-border bg-card divide-y divide-border">
            {FEATURE_KEYS.map((key) => {
              const s: any = settingsMap.get(key);
              if (!s) return null;
              const enabled = s.value === "true";
              return (
                <div key={key} className="flex items-center gap-3 p-3">
                  <div className="flex-1">
                    <div className="text-sm font-medium">{s.description}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">{key}</div>
                  </div>
                  <Switch
                    checked={enabled}
                    onCheckedChange={(v) => save(key, v ? "true" : "false")}
                  />
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
