import { z } from "zod";

export const SOURCE_TYPES = [
  "api",
  "scrapable_page",
  "dataset",
  "rss",
  "mcp",
  "llms_txt",
  "pdf",
  "document",
] as const;

export const AUTH_TYPES = [
  "none",
  "api_key_free",
  "api_key_paid",
  "oauth",
  "unknown",
] as const;

export const DOCUMENT_TYPES = [
  "bill",
  "whitepaper",
  "standard",
  "court_ruling",
  "research_paper",
  "regulation",
  "treaty",
  "other",
] as const;

export const VERIFICATION_STATUSES = [
  "ok",
  "blocked",
  "js_required",
  "rate_limited",
  "paywalled",
  "document_changed",
  "url_dead",
  "server_error",
  "unknown",
] as const;

export const RETIRED_REASONS = ["url_dead", "server_gone", "manual"] as const;

export const documentSchema = z.object({
  document_type: z.enum(DOCUMENT_TYPES),
  publisher: z.string(),
  issued: z.coerce.date().optional(),
  jurisdiction: z.string().optional(),
  canonical: z.boolean().default(false),
  file_size_kb: z.number().optional(),
  pages: z.number().optional(),
});

export const verificationSchema = z
  .object({
    status: z.enum(VERIFICATION_STATUSES).default("unknown"),
    last_checked: z.coerce.date().optional(),
    last_successful_check: z.coerce.date().optional(),
    user_agent_tested: z.string().optional(),
    content_type: z.string().optional(),
    sha256: z.string().optional(),
    consecutive_failures: z.number().int().nonnegative().default(0),
    notes: z.string().optional(),
  })
  .default({ status: "unknown", consecutive_failures: 0 });

const baseShape = {
  name: z.string().min(1),
  url: z.string().url(),
  api_base: z.string().url().optional(),
  type: z.enum(SOURCE_TYPES),
  topics: z
    .array(z.string().regex(/^[a-z0-9-]+$/, "topics must be kebab-case"))
    .min(1),
  description: z.string().min(1),
  why_better: z
    .string()
    .min(20, "why_better must explain why this beats a generic web search"),
  query_examples: z.array(z.string()).optional(),
  auth: z.enum(AUTH_TYPES).default("none"),
  added_by: z.string().optional(),
  document: documentSchema.optional(),
  verification: verificationSchema,
  never_retire: z.boolean().default(false),
  retired_at: z.coerce.date().optional(),
  retired_reason: z.enum(RETIRED_REASONS).optional(),
};

export const sourceSchema = z.object(baseShape).superRefine((data, ctx) => {
  if ((data.type === "pdf" || data.type === "document") && !data.document) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        'Sources of type "pdf" or "document" require a `document:` block.',
      path: ["document"],
    });
  }
});

export type Source = z.infer<typeof sourceSchema>;
