import { execSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import YAML from "yaml";

const BASE_REF = process.env.GITHUB_BASE_REF || "main";
const TIMEOUT_MS = 15000;

function changedSourceFiles(): string[] {
  try {
    const diff = execSync(
      `git diff --name-only --diff-filter=AM origin/${BASE_REF}...HEAD -- sources/`,
      { encoding: "utf8" },
    );
    return diff
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.endsWith(".yaml"));
  } catch (err) {
    console.warn("Could not compute changed files; skipping URL probe.", err);
    return [];
  }
}

async function probe(
  url: string,
): Promise<{ ok: boolean; status: number | string; ms: number }> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "llm-source-registry-probe/1.0 (+https://github.com/)",
      },
    });
    // Some servers return 405 on HEAD; fall back to GET.
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "user-agent": "llm-source-registry-probe/1.0 (+https://github.com/)",
        },
      });
    }
    return {
      ok: res.ok || (res.status >= 300 && res.status < 400),
      status: res.status,
      ms: Date.now() - started,
    };
  } catch (err) {
    return {
      ok: false,
      status: (err as Error).name || "error",
      ms: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const files = changedSourceFiles();
  if (files.length === 0) {
    console.log("No changed source files — nothing to probe.");
    return;
  }

  let hardFailures = 0;
  for (const file of files) {
    const full = join(process.cwd(), file);
    let data: Record<string, unknown>;
    try {
      data = YAML.parse(await readFile(full, "utf8")) ?? {};
    } catch (err) {
      console.error(`✗ ${file}: cannot parse YAML — ${(err as Error).message}`);
      hardFailures++;
      continue;
    }

    const urls = [data.url, data.api_base].filter(
      (u): u is string => typeof u === "string" && u.length > 0,
    );

    for (const url of urls) {
      const result = await probe(url);
      const marker = result.ok ? "✓" : "⚠";
      console.log(
        `${marker} ${file}: ${url} → ${result.status} (${result.ms}ms)`,
      );
    }
  }

  // Reachability warnings do NOT fail the PR — a transient block or 429
  // during CI shouldn't reject a submission. The nightly verify job is the
  // authoritative source of scrapability status. We only fail on YAML parse
  // errors, which validate-sources.ts also catches.
  if (hardFailures > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
