import { getCollection, type CollectionEntry } from "astro:content";

export type SourceEntry = CollectionEntry<"sources">;

// Preference order for LLM consumers: zero friction first.
const AUTH_RANK: Record<string, number> = {
  none: 0,
  api_key_free: 1,
  oauth: 2,
  api_key_paid: 3,
  unknown: 4,
};

// Rank by verification health so `ok` floats to the top.
const STATUS_RANK: Record<string, number> = {
  ok: 0,
  js_required: 1,
  rate_limited: 2,
  document_changed: 3,
  unknown: 4,
  paywalled: 5,
  blocked: 6,
  server_error: 7,
  url_dead: 8,
};

export function sortForLlmConsumers(a: SourceEntry, b: SourceEntry): number {
  const authDiff =
    (AUTH_RANK[a.data.auth] ?? 99) - (AUTH_RANK[b.data.auth] ?? 99);
  if (authDiff !== 0) return authDiff;

  const statusA = a.data.verification?.status ?? "unknown";
  const statusB = b.data.verification?.status ?? "unknown";
  const statusDiff =
    (STATUS_RANK[statusA] ?? 99) - (STATUS_RANK[statusB] ?? 99);
  if (statusDiff !== 0) return statusDiff;

  return a.data.name.localeCompare(b.data.name);
}

export async function getActiveSources(): Promise<SourceEntry[]> {
  const all = await getCollection("sources");
  return all.filter((s) => !s.data.retired_at).sort(sortForLlmConsumers);
}

export async function getNoAuthSources(): Promise<SourceEntry[]> {
  const sources = await getActiveSources();
  return sources.filter((s) => s.data.auth === "none");
}

export async function getAllTopics(): Promise<
  Array<{ slug: string; count: number; noAuthCount: number }>
> {
  const sources = await getActiveSources();
  const counts = new Map<string, number>();
  const noAuthCounts = new Map<string, number>();
  for (const source of sources) {
    for (const topic of source.data.topics) {
      counts.set(topic, (counts.get(topic) ?? 0) + 1);
      if (source.data.auth === "none") {
        noAuthCounts.set(topic, (noAuthCounts.get(topic) ?? 0) + 1);
      }
    }
  }
  return Array.from(counts.entries())
    .map(([slug, count]) => ({
      slug,
      count,
      noAuthCount: noAuthCounts.get(slug) ?? 0,
    }))
    .sort((a, b) => b.count - a.count || a.slug.localeCompare(b.slug));
}

export async function getSourcesForTopic(
  topic: string,
): Promise<SourceEntry[]> {
  const sources = await getActiveSources();
  return sources.filter((s) => s.data.topics.includes(topic));
}

export function authBreakdown(sources: SourceEntry[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of sources) {
    out[s.data.auth] = (out[s.data.auth] ?? 0) + 1;
  }
  return out;
}

export function serializeSource(source: SourceEntry) {
  return {
    id: source.id,
    ...source.data,
  };
}

export function statusPillClass(status: string): string {
  switch (status) {
    case "ok":
      return "ok";
    case "blocked":
    case "paywalled":
    case "url_dead":
    case "server_error":
      return "bad";
    case "rate_limited":
    case "js_required":
    case "document_changed":
      return "warn";
    default:
      return "";
  }
}

export function authPillClass(auth: string): string {
  switch (auth) {
    case "none":
      return "ok";
    case "api_key_free":
      return "warn";
    case "api_key_paid":
    case "oauth":
      return "bad";
    default:
      return "";
  }
}

export function authLabel(auth: string): string {
  switch (auth) {
    case "none":
      return "no API key";
    case "api_key_free":
      return "free API key";
    case "api_key_paid":
      return "paid API key";
    case "oauth":
      return "OAuth";
    default:
      return auth;
  }
}

export function humanizeType(type: string): string {
  switch (type) {
    case "api":
      return "API";
    case "scrapable_page":
      return "Web page";
    case "dataset":
      return "Dataset";
    case "rss":
      return "RSS";
    case "mcp":
      return "MCP server";
    case "llms_txt":
      return "llms.txt";
    case "pdf":
      return "PDF";
    case "document":
      return "Document";
    default:
      return type;
  }
}
