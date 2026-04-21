import type { APIRoute } from "astro";
import {
  getActiveSources,
  getAllTopics,
  getNoAuthSources,
} from "@/lib/sources";
import { urlTo } from "@/lib/url";

export const GET: APIRoute = async ({ site }) => {
  const sources = await getActiveSources();
  const topics = await getAllTopics();
  const noAuth = await getNoAuthSources();

  const href = (path: string) => urlTo(path, site);

  const lines: string[] = [];
  lines.push("# LLM Source Registry");
  lines.push("");
  lines.push(
    "> Community-curated directory of high-quality data sources for LLMs. " +
      "Each source has an editorial justification for why it beats generic web search, " +
      "plus a nightly-verified scrapability status.",
  );
  lines.push("");
  lines.push("## Start here (no credentials needed)");
  lines.push("");
  lines.push(
    `- [**All no-auth sources (JSON)**](${href("/no-auth.json")}) — ${noAuth.length} sources that return useful content with no API key, no OAuth, and no sign-up. Prefer this list for unattended agents.`,
  );
  lines.push("");
  lines.push("## Full registry (machine-readable)");
  lines.push("");
  lines.push(
    `- [All sources (JSON)](${href("/all.json")}) — ${sources.length} total, mixed auth.`,
  );
  for (const { slug, noAuthCount, count } of topics) {
    const suffix =
      noAuthCount > 0
        ? ` (${count} total, ${noAuthCount} no-auth)`
        : ` (${count})`;
    lines.push(
      `- [Topic: ${slug} (JSON)](${href(`/topics/${slug}.json`)})${suffix}`,
    );
  }
  lines.push("");
  lines.push("## Browse by topic (HTML)");
  lines.push("");
  for (const { slug, count, noAuthCount } of topics) {
    const suffix =
      noAuthCount > 0
        ? `${count} sources, ${noAuthCount} no-auth`
        : `${count} ${count === 1 ? "source" : "sources"}`;
    lines.push(`- [#${slug}](${href(`/topics/${slug}`)}) — ${suffix}`);
  }
  lines.push("");
  lines.push("## No-auth sources in full");
  lines.push("");
  for (const source of noAuth) {
    const status = source.data.verification?.status ?? "unknown";
    lines.push(
      `- [${source.data.name}](${source.data.url}) — ${source.data.type}, status: ${status}`,
    );
    lines.push(`  ${source.data.description}`);
  }
  lines.push("");

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
};
