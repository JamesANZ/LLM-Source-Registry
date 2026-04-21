import type { APIRoute } from "astro";
import {
  authBreakdown,
  getActiveSources,
  getAllTopics,
  serializeSource,
} from "@/lib/sources";

export async function getStaticPaths() {
  const topics = await getAllTopics();
  return topics.map(({ slug }) => ({ params: { slug } }));
}

export const GET: APIRoute = async ({ params }) => {
  const slug = params.slug as string;
  const sources = await getActiveSources();
  const filtered = sources.filter((s) => s.data.topics.includes(slug));
  const noAuth = filtered.filter((s) => s.data.auth === "none");

  const body = {
    topic: slug,
    generated_at: new Date().toISOString(),
    count: filtered.length,
    no_auth_count: noAuth.length,
    auth_breakdown: authBreakdown(filtered),
    sources: filtered.map(serializeSource),
  };

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
};
