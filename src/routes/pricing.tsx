import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Free, Pro, Unlimited | RAWL" },
      { name: "description", content: "Translate manga, manhwa, and manhua chapters with RAWL. Free tier, Pro at $5/mo for 50 chapters, Unlimited at $15/mo." },
      { property: "og:title", content: "RAWL Pricing" },
      { property: "og:description", content: "Free forever. Upgrade for unlimited translations." },
    ],
  }),
  component: PricingPage,
});

const PLANS = [
  {
    name: "Free", price: "$0", period: "forever",
    features: ["3 chapters / week", "All 7 target languages", "Long-strip + page reader", "Public chapter library access"],
    cta: "Start free", href: "/signup", featured: false,
  },
  {
    name: "Pro", price: "$5", period: "per month",
    features: ["50 chapters / week", "Priority queue", "Glossary suggestions accepted faster", "Email notifications on follows"],
    cta: "Upgrade to Pro", href: "/signup", featured: true,
  },
  {
    name: "Unlimited", price: "$15", period: "per month",
    features: ["Unlimited chapters", "Highest priority", "Early access to new languages", "Translator badge on credits"],
    cta: "Go Unlimited", href: "/signup", featured: false,
  },
];

function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-6xl px-4 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Read the world's manga in your language.</h1>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">Free to start. Upgrade only when you fall in love with a series.</p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {PLANS.map((p) => (
            <Card key={p.name} className={p.featured ? "border-primary shadow-lg shadow-primary/10" : ""}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold">{p.name}</h2>
                  {p.featured && <Badge>Most popular</Badge>}
                </div>
                <div className="mt-4">
                  <span className="text-4xl font-bold">{p.price}</span>
                  <span className="ml-1 text-sm text-muted-foreground">{p.period}</span>
                </div>
                <ul className="mt-6 space-y-2 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />{f}
                    </li>
                  ))}
                </ul>
                <Button asChild className="mt-6 w-full" variant={p.featured ? "default" : "outline"}>
                  <Link to={p.href}>{p.cta}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="mt-8 text-center text-xs text-muted-foreground">Payments coming soon via Paddle. Pro & Unlimited tiers will activate at launch — sign up now to be notified.</p>
      </div>
    </div>
  );
}
