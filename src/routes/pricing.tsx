import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Crown, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/pricing")({
  head: () => ({ meta: [{ title: "RAWL PRO — Pricing" }] }),
  component: PricingPage,
});

const PLANS = [
  { id: "1m", label: "1 Month", price: 2.99, save: null },
  { id: "3m", label: "3 Months", price: 7.99, save: "Save 11%" },
  { id: "6m", label: "6 Months", price: 14.99, save: "Save 16%" },
  { id: "12m", label: "12 Months", price: 24.99, save: "Save 30%" },
  { id: "gift", label: "Gift (1 month)", price: 3.49, save: "Friend gift" },
];

const FEATURES = [
  "PRO badge next to your username",
  "Ad-free reading experience",
  "30 Ink daily login (instead of 20)",
  "5 free translations per month",
  "Card splitting: 7 free per day",
  "10 marketplace lots (instead of 5)",
  "75 cards per deck (instead of 50)",
  "200 wishlist items (instead of 100)",
  "50-user block list (instead of 10)",
  "Comment Ink: up to 10 times/day",
];

function PricingPage() {
  const { user } = useAuth();
  const [selected, setSelected] = useState("3m");
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [email, setEmail] = useState(user?.email ?? "");

  const plan = PLANS.find((p) => p.id === selected)!;

  const join = async () => {
    if (!email.includes("@")) {
      toast.error("Enter a valid email");
      return;
    }
    const { error } = await supabase
      .from("payment_waitlist")
      .insert({ email, user_id: user?.id ?? null, context: `pro_${selected}` } as never);
    if (error) toast.error(error.message);
    else toast.success("You're on the waitlist!");
    setWaitlistOpen(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-purple-600 to-pink-500 text-white text-xs font-bold uppercase tracking-wider">
            <Crown className="h-3 w-3" /> RAWL PRO
          </div>
          <h1 className="text-3xl font-bold mt-3">Support the platform, unlock more.</h1>
        </div>

        <div className="space-y-2">
          {PLANS.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p.id)}
              className={`w-full flex items-center justify-between rounded-lg border p-4 transition-colors ${
                selected === p.id
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:bg-secondary/40"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`h-4 w-4 rounded-full border-2 ${
                    selected === p.id ? "border-primary bg-primary" : "border-muted-foreground"
                  }`}
                />
                <div className="text-left">
                  <div className="font-semibold text-sm">{p.label}</div>
                  {p.save && <div className="text-[10px] text-emerald-400">{p.save}</div>}
                </div>
              </div>
              <div className="text-lg font-bold">${p.price}</div>
            </button>
          ))}
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-sm font-semibold mb-3">PRO includes</div>
          <ul className="space-y-2">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{f}</span>
              </li>
            ))}
            <li className="flex items-start gap-2 text-sm text-muted-foreground">
              🔜 GIF images in comments (coming soon)
            </li>
          </ul>
        </div>

        <Button size="lg" className="w-full" onClick={() => setWaitlistOpen(true)}>
          Subscribe — ${plan.price}
        </Button>

        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40">
              <tr>
                <th className="text-left p-2">Feature</th>
                <th className="p-2">Free</th>
                <th className="p-2 text-primary">PRO</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Daily login Ink", "20", "30"],
                ["Free translations", "3 lifetime", "5/month"],
                ["Marketplace lots", "5", "10"],
                ["Deck slots", "50", "75"],
                ["Wishlist", "100", "200"],
                ["Block list", "10", "50"],
                ["Comment Ink/day", "5×", "10×"],
                ["Card splits/day", "Paid", "7 free"],
              ].map(([f, free, pro]) => (
                <tr key={f} className="border-t border-border">
                  <td className="p-2">{f}</td>
                  <td className="p-2 text-center text-muted-foreground">{free}</td>
                  <td className="p-2 text-center font-semibold">{pro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={waitlistOpen} onOpenChange={setWaitlistOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Payment coming soon</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Drop your email and we'll notify you when PRO {plan.label} is available.
          </p>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          <Button onClick={join}>Notify me</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
