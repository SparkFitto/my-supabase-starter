// Proxy to MangaDex API to bypass CORS
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { searchQuery } = await req.json();
    if (!searchQuery || typeof searchQuery !== "string") {
      return new Response(JSON.stringify({ error: "Missing searchQuery" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const url = `https://api.mangadex.org/manga?title=${encodeURIComponent(
      searchQuery,
    )}&limit=15&includes[]=cover_art&order[relevance]=desc`;
    const r = await fetch(url, { headers: { "User-Agent": "RAWL/1.0" } });
    const j = await r.json();
    return new Response(JSON.stringify(j), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
