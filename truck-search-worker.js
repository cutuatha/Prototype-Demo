/**
 * Prototype free truck-search proxy for Cloudflare Workers.
 * Store TINYFISH_API_KEY as a Cloudflare Worker Secret. Never commit the key.
 * TinyFish Search and Fetch have free tiers; do not use metered Agent/Browser endpoints.
 */
const ALLOWED_ORIGINS = new Set(["https://cutuatha.github.io"]);
const ALLOWED_DOMAINS = new Set([
  "truckpaper.com",
  "machinerypete.com",
  "mylittlesalesman.com",
  "tmctrucksales.com",
  "deckertrucksales.com",
]);
const SEARCH_DOMAINS = [...ALLOWED_DOMAINS];

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
    const requestedDomain = String(input.domain || "").toLowerCase().replace(/^www\./, "");
    const rawQuery = String(input.query || "").trim().slice(0, 600);
    const domains = requestedDomain === "all" ? SEARCH_DOMAINS : [requestedDomain];
    if (domains.some((d) => !ALLOWED_DOMAINS.has(d))) return json({ error: "Unsupported marketplace domain." }, 400, origin);
    if (!rawQuery) return json({ error: "Search query is required." }, 400, origin);

    // Run a broad query plus make-specific queries when no make is selected.
    // This reduces the chance that one provider ranking (such as Peterbilt 379)
    // dominates results. Explicit make searches remain focused.
    const makeNames = ["Peterbilt", "Kenworth", "Freightliner", "International", "Volvo", "Western Star", "Mack"];
    const lowerQuery = rawQuery.toLowerCase();
    const explicitlyFocused = makeNames.some((make) => lowerQuery.includes(make.toLowerCase()));
    // Focused searches still need wording variants: exact UI filters often include
    // price, location, and exclusion terms that public search engines treat too
    // literally. Keep the original query, then search simpler model-led phrases.
    const makeInQuery = makeNames.find((make) => lowerQuery.includes(make.toLowerCase()));
    const yearMatch = rawQuery.match(/\b(?:19[89]\d|20[0-3]\d)\b/);
    const modelMatch = makeInQuery
      ? rawQuery.slice(lowerQuery.indexOf(makeInQuery.toLowerCase()) + makeInQuery.length).match(/^\s+([a-z0-9-]+)/i)
      : null;
    const model = modelMatch ? modelMatch[1] : "";
    const year = yearMatch ? yearMatch[0] : "";
    const queryTexts = explicitlyFocused
      ? [...new Set([
          rawQuery,
          [year, makeInQuery, model, "sleeper"].filter(Boolean).join(" "),
          [makeInQuery, model, "used semi truck for sale"].filter(Boolean).join(" "),
          [makeInQuery, model, "sleeper tractor truck"].filter(Boolean).join(" "),
          [makeInQuery, "used sleeper semi truck for sale"].filter(Boolean).join(" "),
        ])]
      : [rawQuery, ...makeNames.map((make) => make + " " + rawQuery)];

    const uniqueResults = new Map();
    // Search each marketplace separately instead of combining five site: filters
    // into one query. Search engines often let one domain dominate a combined query,
    // which made the UI claim "all sources" while returning only one marketplace.
    const searches = domains.flatMap((domain) => queryTexts.map(async (text) => {
      const query = "site:" + domain + " " + text;
      const url = new URL("https://api.search.tinyfish.ai/");
      url.searchParams.set("query", query);
      url.searchParams.set("location", "US");
      url.searchParams.set("language", "en");
      url.searchParams.set("page", "0");
      const upstream = await fetch(url.toString(), {
        headers: { "X-API-Key": env.TINYFISH_API_KEY, "Accept": "application/json" },
      });
      const payload = await upstream.json().catch(() => ({}));
      if (!upstream.ok) throw new Error("Search provider returned HTTP " + upstream.status + " for " + domain + ".");
      const results = Array.isArray(payload.results) ? payload.results : [];
      return { domain, query, results, totalResults: Number(payload.total_results || results.length) };
    }));

    try {
      const batches = await Promise.all(searches);
      for (const batch of batches) {
        for (const r of batch.results) {
          let resultUrl = String(r.url || "");
          if (resultUrl && !/^https:\/\//i.test(resultUrl)) resultUrl = "https://" + resultUrl.replace(/^\/+/, "");
          let host = "";
          try { host = new URL(resultUrl).hostname.toLowerCase().replace(/^www\./, ""); } catch {}
          if (!domains.some((d) => host === d || host.endsWith("." + d)) || !resultUrl.startsWith("https://") || !r.title) continue;
          const key = resultUrl.split("#")[0].replace(/\/$/, "").toLowerCase();
          if (!uniqueResults.has(key)) uniqueResults.set(key, {
            title: String(r.title || ""),
            snippet: String(r.snippet || ""),
            url: resultUrl,
            source: String(r.site_name || host),
            date: r.date ? String(r.date) : "",
            isListingPage: true,
            matchedQuery: batch.query,
          });
        }
      }
      const results = [...uniqueResults.values()];
      return json({
        query: "separate marketplace searches (" + domains.join(", ") + ")",
        domain: requestedDomain,
        searchedDomains: domains,
        results,
        totalResults: batches.reduce((sum, b) => sum + b.totalResults, 0),
        searchCount: batches.length,
        provider: "TinyFish Search",
        retrievedAt: new Date().toISOString(),
        note: "Search results are not verified inventory. Confirm the original listing, fixed asking price, auction status, and availability.",
      }, 200, origin);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Search provider failed." }, 502, origin);
    }
  },
};
