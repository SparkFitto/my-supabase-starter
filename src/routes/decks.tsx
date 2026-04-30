import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";

export const Route = createFileRoute("/decks")({
  head: () => ({ meta: [{ title: "Decks — RAWL" }] }),
  component: DecksPage,
});

function DecksPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-10 text-center">
        <h1 className="mb-2 text-2xl font-bold">User Decks</h1>
        <p className="text-muted-foreground">Public deck browsing and creation coming soon.</p>
      </main>
    </div>
  );
}
