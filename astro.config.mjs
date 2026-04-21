import { defineConfig } from "astro/config";

// Auto-derive site + base for GitHub Pages deployments.
//
// Precedence (highest first):
//   1. Explicit SITE / BASE_PATH env vars (custom domain or non-GH host)
//   2. Outputs from actions/configure-pages@v5 (SITE=origin, BASE_PATH=/repo)
//   3. Derivation from GITHUB_REPOSITORY (for local simulation)
//   4. Localhost fallback with base=/
const repoEnv = process.env.GITHUB_REPOSITORY;
let derivedSite;
let derivedBase = "/";

if (repoEnv) {
  const [owner, repo] = repoEnv.split("/");
  if (owner && repo) {
    const lower = owner.toLowerCase();
    if (repo.toLowerCase() === `${lower}.github.io`) {
      derivedSite = `https://${lower}.github.io`;
      derivedBase = "/";
    } else {
      derivedSite = `https://${lower}.github.io`;
      derivedBase = `/${repo}/`;
    }
  }
}

function normalizeBase(value) {
  if (!value || value === "/" || value === "") return "/";
  const withLead = value.startsWith("/") ? value : `/${value}`;
  return withLead.endsWith("/") ? withLead : `${withLead}/`;
}

const site = process.env.SITE || derivedSite || "http://localhost:4321";
const base = normalizeBase(process.env.BASE_PATH ?? derivedBase);

export default defineConfig({
  site,
  base,
  trailingSlash: "never",
  build: {
    format: "file",
    assets: "_astro",
  },
});
