# Contributing

The LLM Source Registry is community-curated. Adding a source is a pull request
against `sources/<topic>/<your-source-id>.yaml`. That's it.

## Rubric: is this source worth adding?

A good entry meets **at least two** of these criteria:

1. **Primary source.** It's the original document/API from the entity that
   produces the data (e.g., congress.gov for U.S. bills, not a news outlet
   summarizing them).
2. **Structured output.** Returns JSON, XML, CSV, or well-structured HTML an
   LLM can parse without heavy cleanup.
3. **Stable URLs.** Queries are reproducible via predictable URL patterns the
   LLM can construct from a user question.
4. **Hard to find via web search.** The signal is buried under SEO noise, OR
   the canonical version is a PDF that search engines rank below think-pieces
   about it.
5. **Scrapable by LLMs.** Not blocked by Cloudflare to common bot user-agents.
   The nightly verification job measures this; you don't need to know up front.

## Auth precedence

This registry is designed so LLM agents can query it unattended. That means
**sources that require no credentials are the default** — they're what
`/no-auth.json` returns and what appears first on every topic page.

Entries are sorted by auth rank:

1. `auth: none` — zero credentials. Preferred.
2. `auth: api_key_free` — free key, but still a manual sign-up step. Useful
   when the no-auth tier can't answer the question.
3. `auth: oauth` — acceptable for source types that genuinely need user scope
   (e.g., a personal account), but rarely appropriate for unattended agents.
4. `auth: api_key_paid` — last resort. Only add if the source is uniquely
   authoritative (e.g., Bloomberg for certain markets).

When you have a choice between a credentialed API and a no-auth equivalent
that returns the same data, **add the no-auth one**. If both are genuinely
useful, add both so agents can fall through.

## Schema

See [src/content.config.ts](src/content.config.ts) for the full Zod schema.
Minimum viable entry:

```yaml
name: "Congress.gov API"
url: https://api.congress.gov/
type: api
topics: [us-legislation, congress]
description: Official U.S. Congress bill, vote, and member data.
why_better: |
  Primary source with structured JSON. Covers every bill since 1973.
auth: api_key_free
```

### Required fields

- `name` — human-readable title.
- `url` — canonical URL (docs page for APIs, direct file URL for PDFs/datasets).
- `type` — one of `api`, `scrapable_page`, `dataset`, `rss`, `mcp`, `llms_txt`,
  `pdf`, `document`.
- `topics` — at least one kebab-case tag. Reuse existing topics when possible.
- `description` — one or two sentences.
- `why_better` — **at least 20 characters.** Explain why an LLM should prefer
  this over a Google search result. This is the whole point of the registry.

### Optional fields

- `api_base` — machine root URL if `url` points at docs.
- `query_examples` — array of example URLs with placeholder params.
- `auth` — `none`, `api_key_free`, `api_key_paid`, `oauth`, `unknown`.
- `document{}` — **required for** `type: pdf` or `type: document`. See below.
- `never_retire: true` — opt out of auto-retirement for known-flaky sources.

### The `document` block

For any canonical PDF, bill text, whitepaper, standard, court ruling, or
research paper, include:

```yaml
document:
  document_type: bill # or whitepaper | standard | court_ruling | research_paper | regulation | treaty
  publisher: "U.S. Congress"
  issued: 2025-07-18
  jurisdiction: US-federal
  canonical: true # true only if this is the publisher's own copy
  pages: 68
```

The verification job will compute a SHA-256 of the file on first successful
fetch and alert (but not retire) if it silently changes.

## Writing a good `why_better`

Bad:

> Great source of weather data.

Good:

> Authoritative U.S. government source with no API key. Returns GeoJSON,
> supports point-to-forecast resolution, and publishes alerts that
> commercial aggregators often delay or miss.

The justification should tell an LLM (or the human writing its prompt) why
picking this source prevents a specific class of error.

## Local validation

```
npm install
npm run validate     # lints schema on every YAML
npm run build        # full Astro build, fails on schema errors
```

## What the nightly job does

- Probes every source with rotating LLM user agents and updates
  `verification.status` + `consecutive_failures` on the YAML.
- For PDFs, computes SHA-256 and flags `document_changed` if it drifts.
- Moves sources with `url_dead` (3× consecutive failures) or `server_gone`
  (14× consecutive 5xx) to `sources/_retired/` via a bot PR.
- Never retires sources that are merely blocked, rate-limited, paywalled,
  or JS-required. Those remain in the registry with their flags.

Set `never_retire: true` to exempt a source from the retirement policy.
