import { useAuth } from "@/lib/auth";

export function useIsPro() {
  const { profile } = useAuth();
  if (!profile) return false;
  const hasPro = (profile as any).has_pro === true;
  const exp = (profile as any).pro_expires_at as string | null | undefined;
  if (!hasPro) return false;
  if (!exp) return true;
  return new Date(exp).getTime() > Date.now();
}
