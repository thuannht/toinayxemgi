# Global spin counter

Standalone Cloudflare Worker + D1. The public frontend stays on GitHub Pages;
this backend has no Sites or OpenAI service dependency.

GET /spins returns `{ "count": 0 }`. POST /spins accepts `{ "id": "<UUID v4>" }`.
The client samples one in eight completed rolls and sends `weight: 8`; a single
SQL update increments the statistical shared total atomically. Legacy tabs omit
the weight and continue to increment by one. No user accounts, IPs, spin IDs, or
selections are stored on the active path. This is an anonymous activity counter,
not a fraud-proof analytics system. Historical spins are not available.
The browser sends JSON bytes with the CORS-safelisted `text/plain` content type,
which avoids a separately billed OPTIONS preflight for every first-time visitor.

GET responses are cached at the edge for five seconds. One in 32 browser sessions
refreshes the shared anchor; other sessions project from the latest local/static
anchor with an exponentially decaying viral rate. POST bursts are limited to 120
per minute per source IP and Cloudflare only uses the IP as an ephemeral rate
limit key; the Worker does not store it. The UI takes at least 7.5 seconds to
complete one spin, so this leaves ample headroom for shared networks while
cutting off accidental or simplistic request floods before D1.

## Deploy

Run from the repository root:

1. `npx wrangler login`
2. `npx wrangler d1 create truanayangi-counter`
3. Copy the returned database_id into counter/wrangler.jsonc's D1 binding.
4. `npx wrangler d1 migrations apply DB --remote --config counter/wrangler.jsonc`
5. `npx wrangler deploy --config counter/wrangler.jsonc`
6. Set counter/public-config.json apiUrl to the returned HTTPS worker URL + /spins.
7. Rebuild and publish the GitHub Pages frontend.

Never put Cloudflare credentials in frontend code. public-config.json contains
only the public endpoint. An empty endpoint hides the counter.

## Local testing

`npx wrangler d1 migrations apply DB --local --config counter/wrangler.jsonc`

`npx wrangler dev --config counter/wrangler.jsonc --var ALLOWED_ORIGIN:http://127.0.0.1:4173 --port 8788`

`node counter/tests/api.mjs`

`NEXT_PUBLIC_COUNTER_API_URL=http://127.0.0.1:8788/spins npx vite build --config vite.pages.config.ts`

The tests write only to local D1 by default. Do not run write/load tests against
the production counter. Back up D1 before any schema change that removes data.
