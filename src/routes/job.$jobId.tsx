import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/job/$jobId")({
  head: () => ({ meta: [{ title: "Translating… — RAWL" }, { name: "robots", content: "noindex" }] }),
  component: JobPage,
});

function JobPage() {
  const { jobId } = Route.useParams();
  const nav = useNavigate();
  const [live, setLive] = useState<{ status: string; progress: number; current_step: string; result_translation_id: string | null; error_message: string | null } | null>(null);

  const { data } = useQuery({
    queryKey: ["job", jobId],
    queryFn: async () => {
      const { data } = await supabase.from("jobs").select("*").eq("id", jobId).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (data) setLive({
      status: data.status,
      progress: data.progress,
      current_step: data.current_step,
      result_translation_id: data.result_translation_id,
      error_message: data.error_message,
    });
  }, [data]);

  useEffect(() => {
    const channel = supabase
      .channel(`job-${jobId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "jobs", filter: `id=eq.${jobId}` }, (p) => {
        const r = p.new as typeof live;
        if (r) setLive(r);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [jobId]);

  useEffect(() => {
    if (live?.status === "completed" && live.result_translation_id) {
      const t = setTimeout(() => nav({ to: "/read/$translationId", params: { translationId: live.result_translation_id! } }), 700);
      return () => clearTimeout(t);
    }
  }, [live, nav]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              {live?.status === "completed" ? <CheckCircle2 className="h-6 w-6 text-success" /> :
               live?.status === "failed" ? <AlertCircle className="h-6 w-6 text-destructive" /> :
               <Loader2 className="h-6 w-6 animate-spin text-primary" />}
              {live?.status === "completed" ? "Translation ready" :
               live?.status === "failed" ? "Translation failed" :
               "Translating chapter"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="mb-2 flex justify-between text-sm">
                <span className="font-mono text-muted-foreground">{live?.current_step ?? "Queued"}</span>
                <span className="font-mono text-foreground">{live?.progress ?? 0}%</span>
              </div>
              <Progress value={live?.progress ?? 0} />
            </div>
            {live?.error_message && (
              <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{live.error_message}</p>
            )}
            {live?.status === "completed" && live.result_translation_id && (
              <Button asChild className="w-full">
                <Link to="/read/$translationId" params={{ translationId: live.result_translation_id }}>Open reader</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
