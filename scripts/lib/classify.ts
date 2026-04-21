export type VerificationStatus =
  | "ok"
  | "blocked"
  | "js_required"
  | "rate_limited"
  | "paywalled"
  | "document_changed"
  | "url_dead"
  | "server_error"
  | "unknown";

export interface ProbeResult {
  status: VerificationStatus;
  httpStatus: number | null;
  contentType: string | null;
  userAgent: string;
  body?: string;
  sha256?: string;
  notes?: string;
}

export const LLM_USER_AGENTS = [
  "Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)",
  "Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
  "Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)",
  "curl/8.4.0",
];

const PAYWALL_MARKERS = [
  "subscribe to continue",
  "to continue reading, subscribe",
  "this content is for subscribers",
  "sign in to read",
  "meter-paywall",
  "data-paywall",
];

const CLOUDFLARE_MARKERS = [
  "attention required! | cloudflare",
  "cf-challenge-running",
  "cf-wrapper",
  "checking your browser before accessing",
  "enable javascript and cookies to continue",
];

export function classifyHttp(
  httpStatus: number,
  contentType: string | null,
  body: string,
): VerificationStatus {
  if (httpStatus === 0) return "url_dead";
  if (httpStatus === 404 || httpStatus === 410) return "url_dead";
  if (httpStatus === 429) return "rate_limited";
  if (httpStatus === 402) return "paywalled";
  if (httpStatus >= 500 && httpStatus < 600) return "server_error";

  const lowerBody = body.slice(0, 20_000).toLowerCase();
  const ct = (contentType ?? "").toLowerCase();

  if (
    httpStatus === 403 ||
    CLOUDFLARE_MARKERS.some((m) => lowerBody.includes(m))
  ) {
    return "blocked";
  }

  if (PAYWALL_MARKERS.some((m) => lowerBody.includes(m))) {
    return "paywalled";
  }

  if (httpStatus >= 200 && httpStatus < 400) {
    // JSON / XML / plain text / PDF / binary data — all clearly machine-usable.
    if (
      ct.includes("application/json") ||
      ct.includes("text/xml") ||
      ct.includes("application/xml") ||
      ct.includes("text/plain") ||
      ct.includes("application/pdf") ||
      ct.includes("application/rss+xml") ||
      ct.includes("application/atom+xml") ||
      ct.includes("text/csv") ||
      ct.includes("application/octet-stream")
    ) {
      return "ok";
    }

    if (ct.includes("text/html")) {
      // Heuristic for JS-only SPAs: tiny body + many <script> tags and almost
      // no visible text.
      const scriptCount = (lowerBody.match(/<script/g) || []).length;
      const textContent = lowerBody
        .replace(/<script[\s\S]*?<\/script>/g, " ")
        .replace(/<style[\s\S]*?<\/style>/g, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (body.length < 4000 && scriptCount >= 2 && textContent.length < 250) {
        return "js_required";
      }
      return "ok";
    }

    return "ok";
  }

  return "unknown";
}
