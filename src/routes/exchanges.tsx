import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";

export const Route = createFileRoute("/exchanges")({
  head: () => ({ meta: [{ title: "Exchanges — RAWL" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    tab: (search.tab as string) ?? "offers",
  }),
  component: ExchangesPage,
});

function ExchangesPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-10 text-center">
        <h1 className="mb-2 text-2xl font-bold">Exchanges</h1>
        <p className="text-muted-foreground">
          Trade offers, history, smelting, and splitting will live here. Coming in the next build phase.
        </p>
      </main>
    </div>
  );
}
