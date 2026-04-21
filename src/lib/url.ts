// Normalize BASE_URL so it always ends with a single trailing slash, regardless
// of trailingSlash config. This lets us safely concatenate relative paths.
const RAW_BASE = import.meta.env.BASE_URL;
const BASE = RAW_BASE.endsWith("/") ? RAW_BASE : `${RAW_BASE}/`;

/**
 * Returns an absolute path rooted at the deployment base.
 * Use for every internal link so the site works under a GitHub Pages project
 * URL like `https://<owner>.github.io/<repo>/`.
 *
 *   pathTo("/topics")          -> "/repo/topics"
 *   pathTo("topics/foo.json")  -> "/repo/topics/foo.json"
 *   pathTo("/")                -> "/repo/"
 */
export function pathTo(path: string): string {
  if (path === "/" || path === "") return BASE;
  const clean = path.replace(/^\/+/, "");
  return BASE + clean;
}

/**
 * Returns a fully-qualified URL including the site origin.
 * Falls back to a relative path if `site` is not defined in astro.config.
 */
export function urlTo(path: string, site: URL | string | undefined): string {
  const p = pathTo(path);
  if (!site) return p;
  try {
    return new URL(p, site).toString();
  } catch {
    return p;
  }
}
