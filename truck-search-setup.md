# Prototype live truck-search setup (free-only)

This connector adds an optional live web-search route to the public Prototype demo. The private Prototype repository is not involved. TinyFish Search/Fetch and Cloudflare Workers have free tiers; limits and terms can change. Do not enable paid features, add a payment method, or fund a TinyFish wallet.

## What this enables

- Live search results inside the game after the connector is deployed.
- TruckPaper, Machinery Pete, and MyLittleSalesman as selectable search sources.
- Search titles, snippets, source names, and original links returned to the page.
- Preliminary asking-price and auction screening in the browser.

## Security first

An API key was shared in chat. **Revoke that key and create a replacement before deploying this connector.** Do not paste the replacement into chat, HTML, or GitHub. Store it only as the Cloudflare Worker Secret described below.

## One-time setup

1. Sign in at https://agent.tinyfish.ai/ and create a replacement API key. TinyFish Search and Fetch are listed as free and do not require a credit card. Do not fund the wallet or use metered Agent/Browser endpoints.
2. Sign in or create a free account at https://dash.cloudflare.com/.
3. Open **Workers & Pages** and create a Worker named `prototype-truck-search`.
4. Replace the starter code with the full contents of `truck-search-worker.js` from this repository, then deploy.
5. In the Worker settings, add a **Secret** named `TINYFISH_API_KEY` and paste the replacement key directly into that secret field. Do not commit it to GitHub. Keep the account on the Free plan.
6. Copy the Worker URL (for example, `https://prototype-truck-search.<your-subdomain>.workers.dev`).
7. Open https://cutuatha.github.io/Prototype-Demo/truck-selection.html, paste the Worker URL into **Live search connector**, and choose **Save connector URL**. Use **Test connection** to verify.

The Worker only allows browser requests from `https://cutuatha.github.io` and accepts the three configured marketplace domains. CORS is not authentication or abuse protection; this is a public demo connector, so keep queries short and do not expose the API key.

## Important limitations

- The connector calls TinyFish Search's documented GET endpoint and scopes each search with a `site:` query. It does not use unsupported `include_domains` parameters.
- This is a web search, not a guaranteed marketplace inventory feed. Search may return stale snippets, category pages, auction results, or listings without a published asking price.
- Prototype's price/auction screening is preliminary. Open the original seller page to verify the current fixed price, non-auction status, availability, location, and truck details before selecting a truck.
- Search and Fetch are free within TinyFish's published limits; Cloudflare Workers usage must remain within the Free plan. No paid APIs, paid hosting, or automatic paid upgrades are part of this setup.
- The connector code is not live-deployed or tested from Cloudflare yet. The setup requires the account owner to create the Worker and add the secret.
