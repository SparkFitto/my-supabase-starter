import { Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Construction } from "lucide-react";

export function ComingSoon({ title, description }: { title: string; description?: string }) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-20 text-center">
        <Construction className="h-12 w-12 text-primary mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">{title}</h1>
        {description && <p className="text-muted-foreground mb-6">{description}</p>}
        <Link to="/" className="text-primary hover:underline text-sm">← Back home</Link>
      </main>
    </div>
  );
}
