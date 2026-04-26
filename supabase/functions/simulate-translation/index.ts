// Simulated translation pipeline. Updates jobs.progress + current_step over time
// so the UI can be tested before the real Python backend is connected.
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STEPS = [
  { step: "Detecting language", progress: 10, ms: 800 },
  { step: "Extracting text bubbles", progress: 25, ms: 1200 },
  { step: "OCR & cleanup", progress: 45, ms: 1500 },
  { step: "Translating with AI", progress: 70, ms: 1800 },
  { step: "Inpainting & typesetting", progress: 90, ms: 1500 },
  { step: "Finalizing", progress: 99, ms: 600 },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { jobId } = await req.json();
    if (!jobId) throw new Error("jobId required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Run steps async — return immediately so client can subscribe to realtime
    (async () => {
      await supabase.from("jobs").update({ status: "running", progress: 5, current_step: "Starting" }).eq("id", jobId);
      for (const s of STEPS) {
        await new Promise((r) => setTimeout(r, s.ms));
        await supabase.from("jobs").update({ progress: s.progress, current_step: s.step }).eq("id", jobId);
      }
      // Pretend to create a translation row with placeholder pages
      const { data: job } = await supabase.from("jobs").select("user_id, target_language, chapter_id").eq("id", jobId).maybeSingle();
      let translationId: string | null = null;
      if (job?.chapter_id) {
        const placeholderPages = Array.from({ length: 8 }, (_, i) =>
          `https://images.unsplash.com/photo-${["1612036782180-6f0822045d23","1607604276583-eef5d076aa5f","1611162617213-7d7a39e9b1d7","1601850494422-3cf14624b0b3","1620336655055-bd87cdf86087","1612036782180-6f0822045d23","1611605698335-8b1569810432","1599689019338-2f3b1d9a0a07"][i] ?? "1611162617213-7d7a39e9b1d7"}?w=900&auto=format&q=75&page=${i + 1}`,
        );
        const { data: t } = await supabase
          .from("translations")
          .insert({
            chapter_id: job.chapter_id,
            target_language: job.target_language,
            translated_by: job.user_id,
            status: "translated",
            published: true,
            image_urls: placeholderPages,
            page_count: placeholderPages.length,
          })
          .select("id")
          .maybeSingle();
        translationId = t?.id ?? null;
      }
      await supabase
        .from("jobs")
        .update({ status: "completed", progress: 100, current_step: "Done", result_translation_id: translationId })
        .eq("id", jobId);
    })().catch(async (err) => {
      console.error("Simulation failed:", err);
      await supabase.from("jobs").update({ status: "failed", error_message: String(err?.message ?? err) }).eq("id", jobId);
    });

    return new Response(JSON.stringify({ ok: true, jobId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String((err as Error).message) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
