import { sourceSchema } from "../src/lib/schema";
import { loadAllSources } from "./lib/fs";

interface ValidationError {
  file: string;
  issues: string[];
}

async function main() {
  const sources = await loadAllSources();
  if (sources.length === 0) {
    console.error("No sources found under ./sources/");
    process.exit(1);
  }

  const errors: ValidationError[] = [];
  const ids = new Map<string, string>();

  for (const src of sources) {
    const parsed = sourceSchema.safeParse(src.data);
    if (!parsed.success) {
      errors.push({
        file: src.relPath,
        issues: parsed.error.issues.map(
          (i) => `  ${i.path.join(".") || "<root>"}: ${i.message}`,
        ),
      });
      continue;
    }

    // Duplicate-id guard (across active + retired).
    const existing = ids.get(src.id);
    if (existing) {
      errors.push({
        file: src.relPath,
        issues: [`  duplicate id "${src.id}" also used by ${existing}`],
      });
    } else {
      ids.set(src.id, src.relPath);
    }
  }

  const ok = sources.length - errors.length;
  console.log(
    `Validated ${sources.length} source(s): ${ok} ok, ${errors.length} failed.`,
  );

  if (errors.length > 0) {
    console.error("");
    for (const err of errors) {
      console.error(`✗ ${err.file}`);
      for (const issue of err.issues) console.error(issue);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
