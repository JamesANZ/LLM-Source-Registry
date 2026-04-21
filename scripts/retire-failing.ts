import { mkdir, rename } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import {
  loadAllSources,
  writeSource,
  SOURCES_DIR,
  RETIRED_DIR,
  type SourceFile,
} from "./lib/fs";

// Retirement thresholds (consecutive nightly failures).
const URL_DEAD_THRESHOLD = 3;
const SERVER_GONE_THRESHOLD = 14;

interface RetirementAction {
  file: SourceFile;
  reason: "url_dead" | "server_gone";
}

function shouldRetire(src: SourceFile): RetirementAction | null {
  if (src.isRetired) return null;

  const data = src.data as {
    never_retire?: boolean;
    verification?: {
      status?: string;
      consecutive_failures?: number;
    };
  };

  if (data.never_retire) return null;

  const status = data.verification?.status;
  const fails = data.verification?.consecutive_failures ?? 0;

  // url_dead: DNS failure, connection refused, 404, or 410.
  if (status === "url_dead" && fails >= URL_DEAD_THRESHOLD) {
    return { file: src, reason: "url_dead" };
  }
  // server_gone: repeated 5xx for long enough to conclude site is truly dead.
  if (status === "server_error" && fails >= SERVER_GONE_THRESHOLD) {
    return { file: src, reason: "server_gone" };
  }

  // Explicitly NOT retired:
  // - blocked / paywalled / js_required / rate_limited / document_changed
  // These remain in the registry with their flag — that's the point.
  return null;
}

async function retire(action: RetirementAction): Promise<string> {
  const { file, reason } = action;
  const relInSources = relative(SOURCES_DIR, file.path);
  const newPath = join(RETIRED_DIR, relInSources);
  await mkdir(dirname(newPath), { recursive: true });

  const data = file.data as Record<string, unknown>;
  const verification = (data.verification ?? {}) as Record<string, unknown>;
  const updated = {
    ...data,
    retired_at: new Date().toISOString(),
    retired_reason: reason,
    verification: {
      ...verification,
      notes: `Auto-retired: ${reason} after ${verification.consecutive_failures ?? "?"} consecutive failures.`,
    },
  };

  await rename(file.path, newPath);
  await writeSource(newPath, updated);
  return newPath;
}

async function main() {
  const sources = await loadAllSources();
  const actions = sources
    .map(shouldRetire)
    .filter((a): a is RetirementAction => a !== null);

  if (actions.length === 0) {
    console.log("No sources meet the retirement criteria.");
    return;
  }

  console.log(`Retiring ${actions.length} source(s):`);
  for (const action of actions) {
    const newPath = await retire(action);
    console.log(
      `  → ${relative(process.cwd(), action.file.path)}  ==>  ${relative(process.cwd(), newPath)} (${action.reason})`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
