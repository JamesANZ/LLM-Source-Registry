import type { APIRoute } from "astro";
import {
  authBreakdown,
  getActiveSources,
  getAllTopics,
  serializeSource,
} from "@/lib/sources";

export const GET: APIRoute = async () => {
  const sources = await getActiveSources();
  const topics = await getAllTopics();

  const body = {
    generated_at: new Date().toISOString(),
    source_count: sources.length,
    topic_count: topics.length,
    auth_breakdown: authBreakdown(sources),
    no_auth_endpoint: "/no-auth.json",
    topics: topics.map((t) => t.slug),
    sources: sources.map(serializeSource),
  };

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
};
