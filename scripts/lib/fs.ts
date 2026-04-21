import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import YAML from "yaml";

export const SOURCES_DIR = join(process.cwd(), "sources");
export const RETIRED_DIR = join(SOURCES_DIR, "_retired");

export interface SourceFile {
  path: string;
  relPath: string;
  id: string;
  raw: string;
  data: Record<string, unknown>;
  isRetired: boolean;
}

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const res = join(dir, entry.name);
      if (entry.isDirectory()) return walk(res);
      if (entry.isFile() && entry.name.endsWith(".yaml")) return [res];
      return [];
    }),
  );
  return files.flat();
}

export async function loadAllSources(): Promise<SourceFile[]> {
  let files: string[] = [];
  try {
    files = await walk(SOURCES_DIR);
  } catch {
    return [];
  }

  const results: SourceFile[] = [];
  for (const path of files) {
    const raw = await readFile(path, "utf8");
    const data = (YAML.parse(raw) ?? {}) as Record<string, unknown>;
    const relPath = relative(SOURCES_DIR, path);
    const isRetired = relPath.split(sep)[0] === "_retired";
    const id = relPath
      .replace(/\.yaml$/, "")
      .split(sep)
      .join("/");
    results.push({ path, relPath, id, raw, data, isRetired });
  }
  return results;
}

export async function writeSource(
  path: string,
  data: Record<string, unknown>,
): Promise<void> {
  const yamlOut = YAML.stringify(data, {
    lineWidth: 0,
    defaultStringType: "PLAIN",
    defaultKeyType: "PLAIN",
  });
  await writeFile(path, yamlOut, "utf8");
}
