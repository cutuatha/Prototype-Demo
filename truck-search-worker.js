/**
 * Prototype truck-search proxy for Cloudflare Workers.
 * Set TINYFISH_API_KEY as a Cloudflare Worker Secret.
 * Never put the API key directly in this file.
 */
const ALLOWED_DOMAINS = new Set([
  "truckpaper.com",
  "machinerypete.com",
  "mylittlesalesman.com",
  "tmctrucksales.com",
  "deckertrucksales.com",
]);
const SEARCH_DOMAINS = [...ALLOWED_DOMAINS];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}

async function tinyfishSearch(query, apiKey) {
  const url = new URL("https://api.search.tinyfish.ai/");
  url.searchParams.set("query", query);
  url.searchParams.set("location", "US");
  url.searchParams.set("language", "en");
  url.searchParams.set("page", "0");

  // Retry one transient provider/server failure before giving up.
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    let response;
    try {
      response = await fetch(url.toString(), {
        headers: {
          "X-API-Key": apiKey,
          "Accept": "application/json",
        },
      });
    } catch (error) {
      lastError = "Could not reach TinyFish Search: " +
        (error instanceof Error ? error.message : String(error));
      if (attempt === 0) continue;
      throw new Error(lastError);
    }

    const bodyText = await response.text();
    let payload = {};
    try { payload = JSON.parse(bodyText); } catch {}

    if (response.ok) {
      return {
        results: Array.isArray(payload.results) ? payload.results : [],
        totalResults: Number(payload.total_results || 0),
      };
    }

    const detail = bodyText.slice(0, 300).replace(/\s+/g, " ").trim();
    lastError = "TinyFish Search returned HTTP " + response.status +
      (detail ? ": " + detail : ".");
    if (response.status < 500 || attempt === 1) {
      throw new Error(lastError);
    }
  }
  throw new Error(lastError || "TinyFish Search failed.");
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, POST, OPTIONS",
          "access-control-allow-headers": "content-type",
          "access-control-max-age": "86400",
        },
      });
    }

    if (request.method === "GET") {
      const configured = Boolean(env.TINYFISH_API_KEY);
      return json({
        ok: true,
        service: "Prototype truck-search Worker",
        providerConfigured: configured,
        message: configured
          ? "Worker is running; provider secret is present."
          : "Worker is running, but TINYFISH_API_KEY secret is missing.",
      }, configured ? 200 : 503);
    }

    if (request.method !== "POST") {
      return json({ error: "Use GET for health check or POST for search." }, 405);
    }
    if (!env.TINYFISH_API_KEY) {
      return json({ error: "Worker is missing its TINYFISH_API_KEY secret." }, 503);
    }

    let input;
    try {
      input = await request.json();
    } catch {
      return json({ error: "Request body must be JSON." }, 400);
    }

    const requestedDomain = String(input.domain || "").toLowerCase().replace(/^www\./, "");
    const rawQuery = String(input.query || "").trim().slice(0, 600);
    const domains = requestedDomain === "all" ? SEARCH_DOMAINS : [requestedDomain];

    if (domains.some((domain) => !ALLOWED_DOMAINS.has(domain))) {
      return json({ error: "Unsupported marketplace domain." }, 400);
    }
    if (!rawQuery) {
      return json({ error: "Search query is required." }, 400);
    }

    const makeNames = [
      "Peterbilt", "Kenworth", "Freightliner", "International",
      "Volvo", "Western Star", "Mack",
    ];
    const lowerQuery = rawQuery.toLowerCase();
    const makeInQuery = makeNames.find((make) => lowerQuery.includes(make.toLowerCase()));
    const yearMatch = rawQuery.match(/\b(?:19[89]\d|20[0-3]\d)\b/);
    const modelMatch = makeInQuery
      ? rawQuery.slice(lowerQuery.indexOf(makeInQuery.toLowerCase()) + makeInQuery.length)
          .match(/^\s+([a-z0-9-]+)/i)
      : null;
    const model = modelMatch ? modelMatch[1] : "";
    const year = yearMatch ? yearMatch[0] : "";

    const queryTexts = makeInQuery
      ? [...new Set([
          rawQuery,
          [year, makeInQuery, model, "sleeper"].filter(Boolean).join(" "),
          [makeInQuery, model, "used semi truck for sale"].filter(Boolean).join(" "),
        ])]
      : [...new Set([rawQuery, "used semi truck for sale " + rawQuery])];

    const uniqueResults = new Map();
    const failedDomains = [];
    let totalResults = 0;
    let searchCount = 0;

    // Search each marketplace separately. Keep failures isolated so one provider
    // error (for example, TruckPaper returning 502) does not discard other results.
    const domainRuns = await Promise.all(domains.map(async (domain) => {
      const domainResults = [];
      let domainTotal = 0;
      let completedQueries = 0;
      let lastError = "";

      for (const text of queryTexts) {
        const query = "site:" + domain + " " + text;
        try {
          const batch = await tinyfishSearch(query, env.TINYFISH_API_KEY);
          completedQueries++;
          domainTotal += batch.totalResults || batch.results.length;

          for (const result of batch.results) {
            let resultUrl = String(result.url || "");
            if (resultUrl && !/^https:\/\//i.test(resultUrl)) {
              resultUrl = "https://" + resultUrl.replace(/^\/+/, "");
            }
            let host = "";
            try {
              host = new URL(resultUrl).hostname.toLowerCase().replace(/^www\./, "");
            } catch {}
            if (
              !(host === domain || host.endsWith("." + domain)) ||
              !resultUrl.startsWith("https://") ||
              !result.title
            ) continue;

            domainResults.push({
              title: String(result.title || ""),
              snippet: String(result.snippet || ""),
              url: resultUrl,
              source: String(result.site_name || host),
              date: result.date ? String(result.date) : "",
              isListingPage: true,
              matchedQuery: query,
            });
          }
          // Avoid extra provider requests once this domain has returned listings.
          if (domainResults.length >= 5) break;
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
          // Continue to the next simpler query; a single failed query is not fatal.
        }
      }

      return {
        domain,
        results: domainResults,
        totalResults: domainTotal,
        searchCount: completedQueries,
        error: completedQueries === 0 ? lastError : "",
      };
    }));

    for (const run of domainRuns) {
      totalResults += run.totalResults;
      searchCount += run.searchCount;
      for (const result of run.results) {
        const key = result.url.split("#")[0].replace(/\/$/, "").toLowerCase();
        if (!uniqueResults.has(key)) uniqueResults.set(key, result);
      }
      if (run.error) failedDomains.push({ domain: run.domain, error: run.error });
    }

    const results = [...uniqueResults.values()];

    if (results.length === 0 && failedDomains.length > 0) {
      return json({
        error: "TinyFish Search failed for every marketplace. The detailed provider error is included below.",
        failedDomains,
        searchedDomains: domains,
        searchCount,
      }, 502);
    }

    return json({
      query: "separate marketplace searches (" + domains.join(", ") + ")",
      domain: requestedDomain,
      searchedDomains: domains,
      results,
      totalResults,
      searchCount,
      failedDomains,
      provider: "TinyFish Search",
      retrievedAt: new Date().toISOString(),
      note: "Search results are not verified inventory. Confirm the original listing, asking price, auction status, and availability.",
    });
  },
};
