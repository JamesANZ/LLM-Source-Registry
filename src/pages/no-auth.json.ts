import type { APIRoute } from "astro";
import { getNoAuthSources, serializeSource } from "@/lib/sources";

// LLM default entry point: every source here returns useful content with
// zero credentials. No API keys, no OAuth, no sign-up.
export const GET: APIRoute = async () => {
  const sources = await getNoAuthSources();

  const body = {
    filter: "auth=none",
    description:
      "Sources that return useful content with no API key, no OAuth, and no sign-up. Prefer this list when an LLM needs to retrieve data unattended.",
    generated_at: new Date().toISOString(),
    source_count: sources.length,
    sources: sources.map(serializeSource),
  };

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
};
