# Prototype live truck-search setup (free-only)

This adds an optional live-search connector to the public Prototype demo. It does not modify the private repository. The search API and Cloudflare Workers have free tiers, but their limits and terms can change. This setup does not require a paid plan; do not enable billing or add a payment method.

## What this enables

- Live web search results shown in the game after the free connector is deployed.
- TruckPaper searched first, with Machinery Pete and MyLittleSalesman as additional sources.
- Search result titles, snippets, source domains, and original links shown inside Prototype.
- The browser still needs to screen for a clearly published fixed asking price and auction status. Search snippets alone do not prove either fact; a result must not be treated as verified seller inventory.

## One-time setup required

The game cannot safely hold the TinyFish API key in its public HTML. The key must be stored as a secret in a server-side Worker. No account credentials or API keys should be committed to GitHub.

1. Create a free TinyFish account at https://agent.tinyfish.ai/ and create an API key. Its Search and Fetch services are advertised as free within published limits. Do not fund the wallet or enable paid Agent/Browser operations.
2. Create a free Cloudflare account at https://dash.cloudflare.com/ if you do not already have one.
3. In Cloudflare, open **Workers & Pages** and create a Worker named `prototype-truck-search`.
4. Replace the starter Worker code with the contents of `truck-search-worker.js` from this repository, then deploy it.
5. In the Worker settings, add a **Secret** named `TINYFISH_API_KEY` and paste the key there. Do not put the key in the game's HTML or into a GitHub file. Redeploy if Cloudflare asks.
6. Copy the Worker URL (it looks like `https://prototype-truck-search.<your-subdomain>.workers.dev`). Enter that URL in the live-search connector field on the truck-selection page and save it in that browser.

The Worker only accepts calls from `https://cutuatha.github.io` and only allows the three configured marketplace domains. If you use a different GitHub Pages origin, the Worker allowlist must be changed accordingly.

## Important limitations

- This is a search integration, not a guaranteed inventory feed. Search engines may omit listings, return stale pages, or show snippets without price.
- A result must be opened at its source and checked for a fixed asking price, non-auction status, and current availability before it is entered as a listing.
- Search is free only within TinyFish's current published allowance. The Worker is on Cloudflare's free plan; keep the account on Free and do not enable paid features.
- The Worker proxy code is a scaffold until it has been deployed and connected to the page. It has not been live-tested from this repository.
