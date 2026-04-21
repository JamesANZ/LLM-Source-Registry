import { createHash } from "node:crypto";
import { sourceSchema } from "../src/lib/schema";
import { loadAllSources, writeSource, type SourceFile } from "./lib/fs";
import {
  LLM_USER_AGENTS,
  classifyHttp,
  type ProbeResult,
  type VerificationStatus,
} from "./lib/classify";

const TIMEOUT_MS = 20_000;
const MAX_BODY_BYTES_HTML = 512 * 1024;
const MAX_PDF_BYTES = 25 * 1024 * 1024;
const CONCURRENCY = 6;
const PROBE_DELAY_BETWEEN_UAS_MS = 400;

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

async function probeOnce(
  url: string,
  userAgent: string,
  wantBinary: boolean,
): Promise<ProbeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": userAgent,
        accept: wantBinary
          ? "application/pdf,application/octet-stream,*/*"
          : "application/json,text/html,text/plain,application/xml,*/*",
      },
    });

    const contentType = res.headers.get("content-type");
    const isPdf =
      (contentType ?? "").toLowerCase().includes("application/pdf") ||
      wantBinary;

    if (isPdf) {
      const bytes: Buffer[] = [];
      let total = 0;
      const reader = res.body?.getReader();
      if (!reader) {
        return {
          status: "url_dead",
          httpStatus: res.status,
          contentType,
          userAgent,
        };
      }
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes.push(Buffer.from(value));
        total += value.length;
        if (total > MAX_PDF_BYTES) break;
      }
      const buf = Buffer.concat(bytes);
      const bodyForClassification = buf.slice(0, 2048).toString("latin1");
      return {
        status: classifyHttp(res.status, contentType, bodyForClassification),
        httpStatus: res.status,
        contentType,
        userAgent,
        sha256: sha256(buf),
      };
    }

    const reader = res.body?.getReader();
    if (!reader) {
      return {
        status: classifyHttp(res.status, contentType, ""),
        httpStatus: res.status,
        contentType,
        userAgent,
      };
    }
    let body = "";
    let total = 0;
    const decoder = new TextDecoder("utf-8", { fatal: false });
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      body += decoder.decode(value, { stream: true });
      total += value.length;
      if (total > MAX_BODY_BYTES_HTML) break;
    }
    body += decoder.decode();

    return {
      status: classifyHttp(res.status, contentType, body),
      httpStatus: res.status,
      contentType,
      userAgent,
      body,
    };
  } catch (err) {
    const msg = (err as Error).message;
    const isAbort = (err as Error).name === "AbortError";
    return {
      status: isAbort ? "server_error" : "url_dead",
      httpStatus: null,
      contentType: null,
      userAgent,
      notes: msg,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function verifySource(src: SourceFile): Promise<void> {
  if (src.isRetired) return;

  const parsed = sourceSchema.safeParse(src.data);
  if (!parsed.success) {
    console.error(`✗ ${src.relPath}: schema invalid, skipping probe.`);
    return;
  }
  const data = parsed.data;

  const isBinaryDoc = data.type === "pdf" || data.type === "document";
  const probeUrl = data.api_base ?? data.url;

  // Rotate user agents — use at most the first two to save time, promote to
  // full rotation if the first probe classifies as blocked.
  let best: ProbeResult | null = null;
  const tried: ProbeResult[] = [];
  for (let i = 0; i < LLM_USER_AGENTS.length; i++) {
    const ua = LLM_USER_AGENTS[i];
    const result = await probeOnce(probeUrl, ua, isBinaryDoc);
    tried.push(result);
    if (!best || rank(result.status) < rank(best.status)) best = result;
    if (best.status === "ok") break; // stop early on success
    if (PROBE_DELAY_BETWEEN_UAS_MS > 0) {
      await new Promise((r) => setTimeout(r, PROBE_DELAY_BETWEEN_UAS_MS));
    }
  }

  const picked = best ?? tried[tried.length - 1];
  let status: VerificationStatus = picked.status;
  let notes = picked.notes;

  // Document-changed detection: compare fresh sha256 with stored one.
  if (isBinaryDoc && status === "ok" && picked.sha256) {
    const previous = (src.data as { verification?: { sha256?: string } })
      .verification?.sha256;
    if (previous && previous !== picked.sha256) {
      status = "document_changed";
      notes = `sha256 drift from previous ${previous.slice(0, 12)}… to ${picked.sha256.slice(
        0,
        12,
      )}…`;
    }
  }

  const prevFailures =
    (src.data as { verification?: { consecutive_failures?: number } })
      .verification?.consecutive_failures ?? 0;
  const consecutive_failures = status === "ok" ? 0 : prevFailures + 1;

  const nowIso = new Date().toISOString();

  // Preserve the prior successful check timestamp when available.
  const prevSuccess = (
    src.data as { verification?: { last_successful_check?: string } }
  ).verification?.last_successful_check;

  const newVerification: Record<string, unknown> = {
    status,
    last_checked: nowIso,
    user_agent_tested: picked.userAgent,
    content_type: picked.contentType ?? undefined,
    consecutive_failures,
  };
  if (status === "ok") {
    newVerification.last_successful_check = nowIso;
  } else if (prevSuccess) {
    newVerification.last_successful_check = prevSuccess;
  }
  if (picked.sha256) newVerification.sha256 = picked.sha256;
  if (notes) newVerification.notes = notes;

  // Strip undefined keys for cleaner YAML.
  for (const k of Object.keys(newVerification)) {
    if (newVerification[k] === undefined) delete newVerification[k];
  }

  const updated = {
    ...(src.data as Record<string, unknown>),
    verification: newVerification,
  };
  await writeSource(src.path, updated);

  console.log(
    `${status === "ok" ? "✓" : "✗"} ${src.relPath}: ${status} (HTTP ${picked.httpStatus ?? "-"}, ` +
      `${consecutive_failures} consecutive failures)`,
  );
}

// Lower is "better" so rank('ok') < rank('blocked').
function rank(status: VerificationStatus): number {
  const order: Record<VerificationStatus, number> = {
    ok: 0,
    js_required: 1,
    rate_limited: 2,
    paywalled: 3,
    document_changed: 4,
    blocked: 5,
    server_error: 6,
    url_dead: 7,
    unknown: 8,
  };
  return order[status];
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
) {
  const queue = [...items];
  const workers = Array.from({ length: limit }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) return;
      try {
        await fn(item);
      } catch (err) {
        console.error("Worker error:", err);
      }
    }
  });
  await Promise.all(workers);
}

async function main() {
  const sources = await loadAllSources();
  const active = sources.filter((s) => !s.isRetired);
  console.log(`Probing ${active.length} active source(s)…`);
  await runWithConcurrency(active, CONCURRENCY, verifySource);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
