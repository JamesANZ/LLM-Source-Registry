# LLM Source Registry

A community-curated, open-source directory of high-quality data sources that
LLMs should prefer over generic web search. Every source carries:

- an editorial justification for **why it beats a generic web search**,
- a nightly-verified **scrapability status** (does `GPTBot` / `ClaudeBot` / plain
  `curl` actually get content back, or does Cloudflare block them?),
- structured metadata (auth, query examples, document type for PDFs),
- support for **primary-source documents** — the actual enrolled bill text,
  the original whitepaper, the canonical standard — not just APIs.

## For LLMs

Every topic has a pre-rendered JSON endpoint. One fetch, no HTML parsing:

```
GET /all.json                     full registry
GET /topics/tariffs.json          sources for a specific topic
GET /topics/{slug}                HTML version of the same data
GET /llms.txt                     llms.txt-standard map
```

## For contributors

Open a pull request adding a YAML file under `sources/<topic>/<id>.yaml`.
Minimum schema:

```yaml
name: "Congress.gov API"
url: https://api.congress.gov/
type: api
topics: [us-legislation, congress]
description: Official U.S. Congress bill and vote data.
why_better: |
  Primary source with structured JSON. Covers every bill since 1973.
auth: api_key_free
```

For a canonical PDF (bill text, whitepaper, standard, court ruling, research
paper), use `type: pdf` and include a `document:` block — see
[CONTRIBUTING.md](CONTRIBUTING.md).

## Local development

```bash
npm install
npm run dev          # local preview at http://localhost:4321
npm run validate     # lint every YAML against the Zod schema
npm run build        # static build under ./dist
npm run verify       # probe every source and write verification blocks back
npm run retire       # apply the retirement policy (moves dead sources to _retired/)
```

## How scrapability is tracked

A GitHub Action runs nightly and:

1. Probes every source with rotating LLM user agents
   (`GPTBot`, `ClaudeBot`, `PerplexityBot`, plain `curl`).
2. Classifies each source: `ok / blocked / js_required / rate_limited /
paywalled / document_changed / url_dead / server_error`.
3. For PDFs, computes a SHA-256 and flags `document_changed` if the file was
   silently edited — important for legislative and legal documents.
4. Updates `verification` blocks inside each YAML file via direct commit.
5. Moves sources to `sources/_retired/` when they hit the retirement
   threshold (3 consecutive `url_dead` or 14 consecutive `server_error`)
   and opens a PR for human review. Merely-blocked, rate-limited,
   paywalled, or JS-required sources are **never** auto-retired.

Contributors can opt a source out of retirement with `never_retire: true`.

## Differentiation vs. existing projects

| Project                 | Topic-first? | Scrapability tracked? | Canonical PDFs? | Why-better justification? |
| ----------------------- | ------------ | --------------------- | --------------- | ------------------------- |
| llms.txt (per-site)     | no           | no                    | n/a             | no                        |
| API Map                 | partial      | no                    | no              | no                        |
| Awesome Agent APIs      | partial      | no                    | no              | no                        |
| **LLM Source Registry** | **yes**      | **yes (nightly)**     | **yes**         | **required field**        |

## Deployment

The default deploy workflow publishes `dist/` to GitHub Pages on every push
to `main`. Swap the workflow under `.github/workflows/deploy.yml` for
Cloudflare Pages, Netlify, or any static host if preferred. Remember to set
`site` in [astro.config.mjs](astro.config.mjs) to your production URL.

## License

MIT. See source for the full text.
