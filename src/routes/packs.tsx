import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/packs")({
  head: () => ({ meta: [{ title: "Card Packs — RAWL" }] }),
  component: PacksPage,
});

function PacksPage() {
  const { profile } = useAuth();
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-10 text-center">
        <h1 className="mb-2 text-3xl font-bold">Card Packs</h1>
        <p className="mb-6 text-muted-foreground">A pack contains 3 random cards. Choose 1 to keep.</p>
        <div className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-base font-bold">
          <span>🖊️</span>
          <span>{profile?.ink_balance ?? 0}</span>
          <span className="text-sm text-muted-foreground">Ink</span>
        </div>
        <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-8">
          <p className="text-sm text-muted-foreground">
            Pack opening flow with reveal animation coming in the next build phase.
            <br />
            Cost: 55 Ink per pack. Pity counters at 50 (S) and 150 (X).
          </p>
        </div>
      </main>
    </div>
  );
}
