/**
 * Prototype free truck-search proxy for Cloudflare Workers.
 * Keep TINYFISH_API_KEY in Cloudflare Worker Secrets; never commit it here.
 * Uses TinyFish Search only (free allowance subject to provider limits).
 */
const ALLOWED_ORIGINS = new Set([
  "https://cutuatha.github.io",
]);
const ALLOWED_DOMAINS = new Set([
  "truckpaper.com",
  "machinerypete.com",
  "mylittlesalesman.com",
]);

function json(data, status = 200, origin = "") {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "vary": "Origin",
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) headers["access-control-allow-origin"] = origin;
  return new Response(JSON.stringify(data), { status, headers });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") {
      if (!ALLOWED_ORIGINS.has(origin)) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: {
        "access-control-allow-origin": origin,
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "content-type",
        "access-control-max-age": "86400",
        "vary": "Origin",
      }});
    }
    if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ error: "Origin not allowed." }, 403, origin);
    if (request.method !== "POST") return json({ error: "Use POST." }, 405, origin);
    if (!env.TINYFISH_API_KEY) return json({ error: "Worker is missing its TINYFISH_API_KEY secret." }, 503, origin);

    let input;
    try { input = await request.json(); } catch { return json({ error: "Request body must be JSON." }, 400, origin); }
    const domain = String(input.domain || "").toLowerCase().replace(/^www\./, "");
    const query = String(input.query || "").trim().slice(0, 700);
    if (!ALLOWED_DOMAINS.has(domain)) return json({ error: "Unsupported marketplace domain." }, 400, origin);
    if (!query) return json({ error: "Search query is required." }, 400, origin);

    const url = new URL("https://api.search.tinyfish.ai/");
    url.searchParams.set("query", query);
    url.searchParams.set("include_domains", domain);
    url.searchParams.set("location", "US");
    url.searchParams.set("language", "en");
    url.searchParams.set("page", "0");

    try {
      const upstream = await fetch(url.toString(), {
        headers: { "X-API-Key": env.TINYFISH_API_KEY, "Accept": "application/json" },
      });
      const payload = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        return json({ error: "Search provider returned HTTP " + upstream.status + ".", providerStatus: upstream.status }, upstream.status, origin);
      }
      const results = Array.isArray(payload.results) ? payload.results.map((r) => ({
        title: String(r.title || ""),
        snippet: String(r.snippet || ""),
        url: String(r.url || ""),
        source: String(r.site_name || domain),
        date: r.date ? String(r.date) : "",
      })).filter((r) => r.url.startsWith("https://") && r.title) : [];
      return json({ query: payload.query || query, domain, results, totalResults: Number(payload.total_results || results.length), provider: "TinyFish Search", retrievedAt: new Date().toISOString() }, 200, origin);
    } catch {
      return json({ error: "Could not reach the search provider. Try again later." }, 502, origin);
    }
  },
};
