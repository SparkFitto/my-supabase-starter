import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function usePlatformSetting(key: string, fallback?: string) {
  const q = useQuery({
    queryKey: ["platform_setting", key],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", key)
        .maybeSingle();
      return (data?.value as string) ?? fallback ?? null;
    },
  });
  return q;
}

export function usePlatformSettingNumber(key: string, fallback = 0) {
  const { data, ...rest } = usePlatformSetting(key, String(fallback));
  const value = data != null ? Number(data) : fallback;
  return { value, ...rest };
}

export function useAllPlatformSettings() {
  return useQuery({
    queryKey: ["platform_settings_all"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("key,value,description,updated_at")
        .order("key");
      return data ?? [];
    },
  });
}
