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

### GitHub Pages (default, zero-config)

The `.github/workflows/deploy.yml` workflow publishes `dist/` to GitHub
Pages on every push to `main`. It uses
[`actions/configure-pages@v5`](https://github.com/actions/configure-pages)
to auto-detect the site origin and base path, then forwards them to
`astro.config.mjs` via `SITE` and `BASE_PATH` env vars. No manual editing
required whether the repo is named `<user>.github.io` (deployed to the
root) or anything else (deployed to `/<repo>/`).

#### REQUIRED one-time setup

> [!IMPORTANT]
> By default GitHub Pages runs Jekyll against your repo's source files,
> which will fail on Astro's `.astro` files with an error like
> `Invalid YAML front matter in src/pages/topics/index.astro`.
> **You must change the Pages source to "GitHub Actions"** before the
> first deploy.

1. Push this project to GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment → Source**, pick **GitHub Actions**
   (not "Deploy from a branch").
4. Go to the **Actions** tab, find "Deploy to GitHub Pages", and click
   **Run workflow** once (or push a new commit to `main`).
5. (Optional) Add a `CNAME` file under `public/` to use a custom domain.

Both `/.nojekyll` and `public/.nojekyll` are included as belt-and-braces,
so even if someone switches Pages back to branch mode, Jekyll will skip
over the source files instead of erroring.

#### Troubleshooting

- `YAML Exception reading .../Base.astro` in the Actions log →
  Pages source is still "Deploy from a branch". Follow step 3 above.
- 404s on sub-pages like `/topics/weather` → make sure Pages source is
  "GitHub Actions", not branch. Branch mode serves the raw repo, not
  the built `dist/`.
- Assets under `_astro/` 404 → ensure `.nojekyll` wasn't deleted from
  the repo root or from `public/`.

### Other hosts

For Cloudflare Pages, Netlify, Vercel, or anywhere else:

- Build command: `npm run build`
- Output directory: `dist`
- Optional env vars:
  - `SITE=https://your-domain.example` (origin, no trailing slash)
  - `BASE_PATH=/` (or `/subpath/` if mounting under a prefix)

### Local preview with a simulated base path

```bash
BASE_PATH=/llm-source-registry SITE=https://example.github.io npm run build
npx astro preview
```

All internal links should point at `/llm-source-registry/...`.

## License

MIT. See source for the full text.
