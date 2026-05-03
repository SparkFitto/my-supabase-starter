import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/topup")({
  head: () => ({ meta: [{ title: "Top Up Ink — RAWL" }] }),
  component: TopUpPage,
});

function TopUpPage() {
  const { user, profile } = useAuth();
  const [waitlistFor, setWaitlistFor] = useState<{ kind: "package" | "contract"; id: string; label: string } | null>(
    null,
  );
  const [email, setEmail] = useState(user?.email ?? "");

  const { data: packages, isLoading } = useQuery({
    queryKey: ["ink_packages"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ink_packages")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      return data ?? [];
    },
  });

  const { data: contract } = useQuery({
    queryKey: ["active_contract"],
    queryFn: async () => {
      const { data } = await supabase
        .from("contracts")
        .select("*")
        .eq("is_active", true)
        .order("price_usd")
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: userContract } = useQuery({
    queryKey: ["user_contract", user?.id],
    enabled: !!user && !!contract,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_contracts")
        .select("*")
        .eq("user_id", user!.id)
        .eq("contract_id", contract!.id)
        .eq("is_active", true)
        .maybeSingle();
      return data;
    },
  });

  const { data: topDonors } = useQuery({
    queryKey: ["top_donors"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("id,username,avatar_url,monthly_ink_purchased")
        .gt("monthly_ink_purchased", 0)
        .order("monthly_ink_purchased", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const monthlySpend = (profile as any)?.monthly_spend_usd ?? 0;
  const patronBonus =
    monthlySpend >= 50 ? 10 : monthlySpend >= 20 ? 5 : monthlySpend >= 10 ? 2 : monthlySpend >= 5 ? 1 : 0;

  const submitWaitlist = async () => {
    if (!email || !email.includes("@")) {
      toast.error("Enter a valid email");
      return;
    }
    const table = waitlistFor!.kind === "contract" ? "contract_waitlist" : "payment_waitlist";
    const payload: any = { email, user_id: user?.id ?? null };
    if (waitlistFor!.kind === "package") payload.package_id = waitlistFor!.id;
    else payload.contract_id = waitlistFor!.id;
    const { error } = await supabase.from(table as any).insert(payload as never);
    if (error) toast.error(error.message);
    else toast.success("You're on the list!");
    setWaitlistFor(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Top Up Ink</h1>
          {user && (
            <p className="text-sm text-muted-foreground">
              Current balance: 🖊️ <span className="font-bold">{profile?.ink_balance ?? 0}</span>
            </p>
          )}
        </div>

        {/* Patron level */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Patron Level</div>
              <div className="text-xs text-muted-foreground">Spend more, earn more this month</div>
            </div>
            <Badge variant="outline" className="text-sm font-bold text-primary">
              +{patronBonus}% bonus
            </Badge>
          </div>
          <Progress value={Math.min(100, (monthlySpend / 50) * 100)} className="h-2" />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>$0</span>
            <span>$5 (+1%)</span>
            <span>$10 (+2%)</span>
            <span>$20 (+5%)</span>
            <span>$50 (+10%)</span>
          </div>
        </div>

        {/* Chronicler's Pact */}
        {contract && (
          <div className="rounded-xl border border-border bg-gradient-to-br from-purple-900/40 to-purple-700/20 p-5">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="text-xs uppercase text-purple-300">Battle Pass</div>
                <h2 className="text-xl font-bold">{contract.name}</h2>
              </div>
              <Badge className="text-base">${contract.price_usd}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-3">{contract.description}</p>
            <div className="text-3xl font-extrabold text-primary">
              {contract.total_ink.toLocaleString()} 🖊️
            </div>
            <div className="text-xs text-muted-foreground mb-4">over {contract.duration_days} days</div>

            <div className="grid grid-cols-10 gap-1 mb-4">
              {[...Array(contract.duration_days)].map((_, i) => {
                const day = i + 1;
                const isMilestone = [7, 14, 21, 28].includes(day);
                const claimed = userContract && day <= (userContract.days_claimed ?? 0);
                return (
                  <div
                    key={day}
                    className={`aspect-square rounded text-[9px] flex items-center justify-center ${
                      claimed
                        ? "bg-primary text-primary-foreground"
                        : isMilestone
                          ? "bg-amber-500/30 border border-amber-500 text-amber-200"
                          : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {day}
                  </div>
                );
              })}
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={() => setWaitlistFor({ kind: "contract", id: contract.id, label: contract.name })}
            >
              Subscribe — ${contract.price_usd}/mo (Notify me)
            </Button>
          </div>
        )}

        {/* Top donors */}
        {topDonors && topDonors.length > 0 && (
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-sm font-semibold mb-3">Top Supporters This Month</div>
            <div className="space-y-2">
              {topDonors.map((d: any, i: number) => (
                <div key={d.id} className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground w-5">#{i + 1}</span>
                  <div className="h-7 w-7 rounded-full bg-muted overflow-hidden">
                    {d.avatar_url && <img src={d.avatar_url} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <span className="flex-1 truncate">@{d.username}</span>
                  <span className="text-primary font-bold">{d.monthly_ink_purchased.toLocaleString()} 🖊️</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Packages */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Add Ink to Your Balance</h2>
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-40" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {packages?.map((pkg: any) => (
                <div
                  key={pkg.id}
                  className="relative rounded-lg border border-border bg-card p-4 flex flex-col"
                >
                  {pkg.is_popular && (
                    <Badge className="absolute -top-2 right-2 bg-primary">Popular</Badge>
                  )}
                  {pkg.is_vip && (
                    <Badge className="absolute -top-2 right-2 bg-amber-500 text-black">VIP</Badge>
                  )}
                  <div className="text-2xl font-extrabold">
                    {pkg.ink_amount.toLocaleString()} <span className="text-base">🖊️</span>
                  </div>
                  {pkg.first_purchase_bonus_percent > 0 && (
                    <div className="text-[10px] text-emerald-400 font-semibold mt-1">
                      First purchase: ×2 bonus!
                    </div>
                  )}
                  {pkg.bonus_percent > 0 && (
                    <div className="text-[10px] text-primary font-semibold">+{pkg.bonus_percent}% bonus</div>
                  )}
                  <div className="text-lg font-bold mt-2">${pkg.price_usd}</div>
                  <Button
                    size="sm"
                    className="mt-2 w-full"
                    onClick={() => setWaitlistFor({ kind: "package", id: pkg.id, label: `${pkg.ink_amount} Ink` })}
                  >
                    Get Ink — ${pkg.price_usd}
                  </Button>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-3 text-center">
            💬 Pay via Telegram? Message us @rawl_support
          </p>
        </div>
      </div>

      <Dialog open={!!waitlistFor} onOpenChange={(o) => !o && setWaitlistFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Payment coming soon!</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            We're setting up payment processing for your region. Drop your email and we'll notify you the moment{" "}
            <span className="font-semibold">{waitlistFor?.label}</span> is live.
          </p>
          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button onClick={submitWaitlist}>Join waitlist</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
