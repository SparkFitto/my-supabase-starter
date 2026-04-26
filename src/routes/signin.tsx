import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/signin")({
  head: () => ({
    meta: [
      { title: "Sign in — RAWL" },
      { name: "description", content: "Sign in to RAWL to translate manga, manhwa, and manhua chapters." },
    ],
  }),
  component: SignInPage,
});

function SignInPage() {
  const { signIn, signInWithGoogle } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) setErr(error.message);
    else nav({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto flex max-w-md flex-col px-4 py-16">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Welcome back</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" className="w-full" onClick={() => signInWithGoogle()}>
              Continue with Google
            </Button>
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link to="/reset-password" className="text-xs text-primary hover:underline">Forgot?</Link>
                </div>
                <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              {err && <p className="text-sm text-destructive">{err}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </form>
            <p className="text-center text-sm text-muted-foreground">
              No account?{" "}
              <Link to="/signup" className="text-primary hover:underline">Create one</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
