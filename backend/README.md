# BridgeKitty / Backend

Thin Express proxy in front of the [Persistence BridgeKitty API](https://api.bridgekitty.persistence.one/api/v1). Production URL is tentatively [api.bridgekitty.persistence.one](https://api.bridgekitty.persistence.one/api/health).

Every route forwards to Persistence — routing, quoting, status tracking, wallet registration, swap/transaction records, and analytics all live upstream. This service exists to give the frontend a same-origin API surface with CORS, rate limiting, input validation, and a sanity filter applied before requests leave our network.

For the project overview, architecture diagram, and end-to-end flow, see [the root README](../README.md).

---

## Contents

- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Running locally](#running-locally)
- [Environment variables](#environment-variables)
- [Source layout](#source-layout)
- [API reference](#api-reference) — every route, every field
  - [Health](#health) · [Chains](#chains) · [Tokens](#tokens) · [Wallets](#wallets) · [Quotes](#quotes) · [Swaps](#swaps) · [Transactions](#transactions) · [Status](#status) · [Stats](#stats)
- [Quote response — fee fields](#quote-response--fee-fields)
- [Sanity filter](#sanity-filter)
- [Scripts](#scripts)

---

## Tech stack

| | |
|---|---|
| Framework | Express |
| Language | TypeScript |
| Validation | Zod (env config) + handwritten guards (per-route) |
| Security | Helmet + CORS + express-rate-limit |
| Logging | Morgan |

No database. No provider SDKs. Just `fetch` + validation.

---

## Architecture

The service exists for five reasons (in priority order):

1. **Same-origin API surface for the frontend.** Browser sees `bridgekitty.persistence.one/api/...`, simple CORS rules.
2. **Rate limiting** per IP — 30 quote requests/min in production. Skipped entirely when `NODE_ENV=development`.
3. **Input validation** before requests leave our network — bad amounts / addresses get a `400` from us, not from Persistence.
4. **Quote-shape unification.** Persistence returns every provider's quotes in one response. The backend (a) fans out the `/execute` calls per provider, (b) normalizes the result into the frontend's expected shape, (c) applies the sanity filter.
5. **Fee plumbing.** When/if BridgeKitty starts charging an integrator fee, this is where it surfaces. Today it's `0` everywhere — see [Quote response — fee fields](#quote-response--fee-fields).

### Quote-round lifecycle

A single round looks like this:

```
Frontend                 Backend                              Persistence
   │                        │                                       │
   │  POST /api/quotes      │                                       │
   │ ─────────────────────▶ │                                       │
   │                        │  POST /api/v1/quote                   │
   │                        │ ────────────────────────────────────▶ │
   │                        │                                       │  one call,
   │                        │                                       │  every provider's
   │                        │                                       │  quotes returned
   │                        │ ◀──────────────────────────────────── │
   │                        │                                       │
   │                        │  pickBestQuoteForProvider(...)        │
   │                        │  for each of {lifi, debridge, squid,  │
   │                        │  relay, across}                       │
   │                        │                                       │
   │                        │  POST /api/v1/execute (×N in parallel)│
   │                        │ ────────────────────────────────────▶ │
   │                        │ ◀──────────────────────────────────── │
   │                        │                                       │
   │                        │  sanity filter — drop output outliers │
   │                        │                                       │
   │                        │  build response                       │
   │ ◀───────────────────── │                                       │
   │  { quotes: { lifi, debridge, ... },                            │
   │    failed: { squid: 'no route ...', ... } }                    │
```

**One** upstream `/quote` call regardless of how many providers were requested. **N** parallel `/execute` calls (one per provider with a route). No race conditions, no `quoteId` collisions, no per-provider HTTP fan-out from the browser.

### Why the upstream `/quote` is shared (in-flight dedup)

Persistence's `/quote` returns the same `quoteId` for identical request params (cache). If the backend's frontend launched two concurrent rounds for the same `(chain, token, amount, wallet)` tuple, both would hit `/execute` with the same cached `quoteId` and the second would get HTTP 409 "This quote is already being executed."

The backend dedups concurrent identical upstream calls via an in-flight `Map`:

- First handler that arrives fires the upstream `/quote` call.
- All other concurrent handlers awaiting the same canonical key share the same promise.
- Map entry is deleted in `.finally()` so future rounds re-fetch.

This handles the 60s auto-refresh, multi-tab traffic from the same wallet, and any rapid succession of requests within the same backend instance. Across-instance collisions are still possible behind a load balancer; for those, `executeWithRecovery` retries 409s with exponential backoff up to 3 attempts.

---

## Running locally

```bash
npm install
cp .env.example .env
npm run dev
# → http://localhost:8080
```

`tsx watch` provides hot-reload on file changes.

Verify it's up:

```bash
curl http://localhost:8080/api/health
# {"ok":true,"service":"bridgekitty-api","upstream":"connected"}
```

**No credentials required** — Persistence needs no integrator auth header for routing/quoting.

---

## Environment variables

Defined and validated in [`src/config/env.ts`](src/config/env.ts). Missing or malformed values cause the server to exit on startup.

```env
# Server
NODE_ENV=development
PORT=8080
CORS_ORIGIN=http://localhost:5173

# Persistence BridgeKitty API — routing, quotes, status, and user data all live upstream
PERSISTENCE_API_BASE_URL=https://api.bridgekitty.persistence.one/api/v1
```

| Variable | Required | Default | What it does |
|---|:---:|---|---|
| `NODE_ENV` | yes | `development` | When `production`: enables rate limiting on `/quotes`, hides stack traces and stringified errors from response bodies, locks CORS to `CORS_ORIGIN`. |
| `PORT` | yes | `8080` | TCP port to bind. |
| `CORS_ORIGIN` | yes | `http://localhost:5173` | Comma-separated origin allowlist. Multiple frontends supported (`http://localhost:5173,https://staging.example.com`). Only enforced when `NODE_ENV=production`; in development all origins pass. |
| `PERSISTENCE_API_BASE_URL` | yes | `https://api.bridgekitty.persistence.one/api/v1` | Upstream Persistence API base URL. Override only if pointing at a Persistence staging environment. |

---

## Source layout

```
src/
├── config/
│   └── env.ts                  Zod-validated environment config (fails fast on bad input)
├── lib/
│   └── persistence.ts          Shared `fetch` helper for the upstream API
├── routes/
│   ├── index.ts                Mounts every router on `/api`
│   ├── health.routes.ts        GET /api/health
│   ├── chains.routes.ts        GET /api/chains   (proxy)
│   ├── tokens.routes.ts        GET /api/tokens   (proxy)
│   ├── wallets.routes.ts       POST /api/wallets (proxy)
│   ├── quotes.routes.ts        POST /api/quotes  ← the interesting one
│   ├── swaps.routes.ts         POST/GET /api/swaps        (proxy)
│   ├── transactions.routes.ts  POST/GET /api/transactions (proxy)
│   ├── status.routes.ts        GET /api/status   (proxy with trackingId validation)
│   └── stats.routes.ts         GET /api/stats    (proxy with soft-fail)
└── index.ts                    Express app entry — Helmet, CORS, JSON, Morgan, routers
```

Every "proxy" route is a one-pass forward: validate input → `fetch` Persistence → forward response. Only `/api/quotes` does meaningful local work.

---

## API reference

Base URL: `http://localhost:8080/api` (or `https://api.bridgekitty.persistence.one/api` in production).

All response shapes match the Persistence API verbatim, except where noted.

### Health

```
GET /api/health
```

Returns backend liveness + Persistence upstream reachability. Used by uptime monitoring.

**Response — 200**
```json
{ "ok": true, "service": "bridgekitty-api", "upstream": "connected" }
```

`upstream: "disconnected"` means Persistence `/health` didn't respond — the backend is still up but data routes will return `502` until it recovers.

---

### Chains

```
GET /api/chains
```

Proxies Persistence `/chains`. Cached upstream (~10 minutes). Returns the full list of supported chains and the providers that cover each.

**Response — 200**
```json
{
  "chains": [
    { "chainId": 1, "key": "ethereum", "name": "Ethereum", "nativeSymbol": "ETH", "providers": ["lifi","squid","debridge","relay","across"] },
    { "chainId": 8453, "key": "base", "name": "Base", "nativeSymbol": "ETH", "providers": [...] }
  ]
}
```

---

### Tokens

```
GET /api/tokens?chainId={chainId}
```

Proxies Persistence `/tokens`. **Required** query param `chainId`. Returns the token list for a single chain. Native tokens use the sentinel address `0xEeee...EeEe` in the upstream response; the frontend uses the same convention.

**Response — 200**
```json
{
  "tokens": [
    { "address": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", "symbol": "ETH",  "decimals": 18, "name": "Ether",     "logoURI": "..." },
    { "address": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", "symbol": "USDC", "decimals": 6,  "name": "USD Coin", "logoURI": "..." }
  ]
}
```

---

### Wallets

```
POST /api/wallets
```

Registers or upserts a wallet. **Idempotent** — safe to call on every connect.

**Request body**
```json
{ "address": "0xe795c0fb87bcc6c7c1f9e9acdd0e3afaa2c620f4" }
```

The address is validated as `0x` + 40 hex characters before being forwarded.

**Response — 200**
```json
{
  "id": "uuid",
  "address": "0xe79...20f4",
  "lastSeenAt": "2026-04-25T09:00:00Z",
  "createdAt":  "2026-01-01T00:00:00Z",
  "updatedAt":  "2026-04-25T09:00:00Z"
}
```

---

### Quotes

```
POST /api/quotes
```

The one route that does real work. Returns the best quote from **every** supported provider for a single swap request, in **one** round-trip — including the unsigned transaction calldata each provider would broadcast.

**Rate-limited** to 30 requests/min per IP in production (skipped in development).

#### Request body

```json
{
  "srcChainKey":      "base",
  "dstChainKey":      "polygon",
  "srcTokenAddress":  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  "dstTokenAddress":  "0x0000000000000000000000000000000000000000",
  "amount":           "10001414",
  "srcWalletAddress": "0xe795c0fb87bcc6c7c1f9e9acdd0e3afaa2c620f4",
  "dstWalletAddress": "0xe795c0fb87bcc6c7c1f9e9acdd0e3afaa2c620f4"
}
```

| Field | Type | Notes |
|---|---|---|
| `srcChainKey` | string | One of `ethereum`, `base`, `bsc`, `polygon`, `monad`, or a numeric chain ID. |
| `dstChainKey` | string | Same set as `srcChainKey`. |
| `srcTokenAddress` | hex string | Source token. Native tokens may be `0x0000...0000` or the sentinel `0xEeeE...EeEe` — both are normalized to `0x0000...0000` before forwarding. |
| `dstTokenAddress` | hex string | Same convention as `srcTokenAddress`. |
| `amount` | string | Raw integer in **smallest token units** (wei for ETH, etc.). Must match `^\d+$`. |
| `srcWalletAddress` | hex string | Connected wallet. **Required**. Cannot be zero. |
| `dstWalletAddress` | hex string | Optional. If present, **must equal** `srcWalletAddress`. Cross-wallet bridging is not supported. |

#### Validation guards

| Failure | HTTP status |
|---|---:|
| Missing `srcTokenAddress`/`dstTokenAddress`/`amount` | `400` |
| `amount` not a numeric string | `400` |
| Unknown chain key | `400` |
| `srcWalletAddress` missing or zero | `400` |
| `dstWalletAddress` non-zero but not equal to `srcWalletAddress` | `400` |
| Persistence reports no route for any provider | `200` with `failed[provider]: "no routes for this token pair"`; `quotes` is empty for that provider |
| Persistence `/quote` upstream error | `502` (or upstream's status if 4xx) |

#### Response — 200

```json
{
  "quotes": {
    "lifi": {
      "id":           "fb195d6f-a7bd-48bf-a081-0fe83e58f364",
      "trackingId":   "lifi:gasZipBridge:1777090428673",
      "routeSteps":   [{ "type": "ETH → GasZip → BNB" }],
      "feeUsd":       "0.030000",
      "fixFeeUsd":    null,
      "integratorFeeUsd": null,
      "duration":     { "estimated": "1000" },
      "dstAmount":    "1009624148497625",
      "dstAmountMin": "979335424042696",
      "userSteps": [{
        "type":   "TRANSACTION",
        "action": "Submit transaction from wallet.",
        "transaction": {
          "to":    "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE",
          "data":  "0x606326ff...",
          "value": "0x0",
          "gasLimit": "0x12762c",
          "gasPrice": null,
          "maxFeePerGas": null,
          "maxPriorityFeePerGas": null
        }
      }]
    },
    "debridge": { "...": "same shape" }
  },
  "failed": {
    "squid":  "no routes for this token pair",
    "relay":  "no routes for this token pair",
    "across": "no routes for this token pair"
  }
}
```

| Top-level field | Notes |
|---|---|
| `quotes` | Object keyed by provider (`lifi`, `debridge`, `squid`, `relay`, `across`). Each value is the cheapest quote for that provider, or the key is absent if that provider had no route. |
| `failed` | Object keyed by provider. Value is the upstream reason a quote couldn't be produced. The same provider never appears in both `quotes` and `failed`. |

| Per-quote field | Source | Meaning |
|---|---|---|
| `id` | `quoteId` | Unique Persistence quote ID — opaque identifier. |
| `trackingId` | `trackingId` from `/execute` | Used by `/api/status?provider={trackingId}` to poll bridge status. Format: `<provider>:<id>`. |
| `routeSteps[0].type` | `route` | Human-readable route, e.g. `"ETH → deBridge DLN → MATIC"`. |
| `feeUsd` | `feeBreakdown.totalFeeUsd` | All-in USD fee — gas + protocol + (deBridge) DLN solver + (any) integrator. **Stringified to 6 decimals.** |
| `fixFeeUsd` | `feeBreakdown.fixFeeUsd` | deBridge only. The fixed DLN solver fee, paid in the source chain's native token as extra `msg.value`. **Omitted (undefined) when absent or zero.** |
| `integratorFeeUsd` | `feeBreakdown.integratorFeeUsd` | BridgeKitty's own take, routed through Persistence's integrator-fee plumbing. Currently `0` on every provider — surfaced as `undefined` so the frontend renders "Free ✓". Auto-populates when Persistence is configured to charge an integrator fee for our key; **no code deploy needed**. |
| `duration.estimated` | `estimatedTimeSeconds × 1000` | Estimated bridge duration, in **milliseconds** (string). Frontend divides by 1000 to display "~Xs". |
| `dstAmount` | `outputAmountRaw` | Destination amount in raw integer units. **Use this for on-chain math** (frontend calls `BigInt()` on it). |
| `dstAmountMin` | `minOutputAmountRaw` | Minimum guaranteed destination amount (after slippage tolerance). Falls back to `dstAmount` when upstream omits it. |
| `userSteps[0].transaction` | from `/execute` | The unsigned transaction the user must sign to start the bridge. |

#### Fields we deliberately don't surface

- **`feeBreakdown.protocolFeeUsd`** — for deBridge this combines `fixFeeUsd + operatingExpense`. We expose the explicit `fixFeeUsd` so the "DLN solver fee" line matches what the user is actually charged for the solver.
- **`feeBreakdown.operatingExpenseRaw`** — the deBridge DLN solver's margin/spread. Funds the solver network, not BridgeKitty. Already rolled into the headline `feeUsd`; not broken out in the UI because no other provider exposes an equivalent.
- **`feeBreakdown.integratorFeePercent`** — always `null` today. We display USD, not percent.

---

### Swaps

```
POST /api/swaps     Record a swap at quote-acceptance
GET  /api/swaps     Get swap records
```

Proxies Persistence `/swaps`. `POST` upserts a `TransactionHistory` row upstream when `txHash` is supplied — a single `POST` after the user signs covers both records.

**`GET /api/swaps?userAddress={address}&limit={n}`**

```json
{
  "swaps": [
    {
      "id": "uuid",
      "userAddress": "0x...",
      "srcChainId": 8453,
      "dstChainId": 137,
      "srcTokenAddress": "0x...",
      "dstTokenAddress": "0x...",
      "amountIn": "10001414",
      "amountOut": "496897282604654517167",
      "provider": "debridge",
      "txHash": "0x...",
      "status": "completed",
      "createdAt": "..."
    }
  ]
}
```

---

### Transactions

```
POST /api/transactions    Record a signed and broadcast transaction
GET  /api/transactions    Get transaction history (?userAddress=&limit=)
```

Proxies Persistence `/transactions`. `POST` is **idempotent** on `(userAddress, txHash)` — safe to retry.

---

### Status

```
GET /api/status?provider={trackingId}&fromChain={key}&txHash={hash}
```

Forwards to Persistence `/status/:trackingId`. The `provider` query param is the full Persistence trackingId returned at quote time (e.g. `lifi:0xabc...`, `debridge:0xorderhash...`) — the backend forwards it verbatim as a path segment.

**Validation**: the trackingId must match `^[a-z]+:[a-z0-9:_-]+$` and be ≤128 chars. This guards against path injection.

**Response — 200**
```json
{
  "status": "bridging",
  "fromChainTxHash": "0x...",
  "toChainTxHash":   null,
  "completedAt":     null
}
```

Possible `status` values after mapping: `submitted`, `confirming`, `bridging`, `completed`, `failed`.

---

### Stats

```
GET /api/stats?period=7d|15d|30d|all
```

Proxies Persistence `/stats`. **Fails soft** — returns zeros on upstream error so the landing page doesn't break.

```json
{
  "period": "7d",
  "uniqueUsers": 42,
  "swapVolumeUsd": 18500,
  "swapCount": 103
}
```

---

## Quote response — fee fields

Each quote exposes every fee Persistence breaks out, without re-computing anything locally. Cross-reference with the [Fees section in the root README](../README.md#fees) for the user-facing labels.

| Field | Source | Meaning |
|---|---|---|
| `feeUsd` | `feeBreakdown.totalFeeUsd` | All-in USD cost of the swap (gas + protocol + solver + integrator). The headline number. |
| `fixFeeUsd` | `feeBreakdown.fixFeeUsd` | deBridge only. The fixed DLN solver fee, paid in the source chain's native token as extra `msg.value` on top of the swap. Omitted when absent or zero. |
| `integratorFeeUsd` | `feeBreakdown.integratorFeeUsd` | BridgeKitty's own take. **Currently `0` on every provider**. The frontend renders "Free ✓" when `undefined`/`0`, and `formatUsd(...)` otherwise. Populates automatically when Persistence is configured to charge an integrator fee for us — **no code deploy needed**. |

---

## Sanity filter

After fanning out `/execute` calls, the backend applies a single sanity check on the per-provider quotes before returning them.

**What it guards against.** Persistence sometimes forwards same-asset bridge quotes (notably **Across**) for cross-asset swap requests. Across only bridges identical assets across chains (ETH→ETH, USDC→USDC) — it doesn't swap. When we ask Persistence for "ETH on Base → POL on Polygon", Across replies with a quote that delivers ~0.02 ETH-equivalent (as WETH on Polygon), but Persistence labels it as the requested toToken (POL). Result: a quote claiming "0.0199 POL" sits next to legitimate "496 POL" routes — and ranked as "best" because of its tiny implicit fee.

**How we detect it.** Compute every winner's output in human-readable units (`raw / 10^decimals`), find the max, drop anything below `OUTLIER_THRESHOLD × max`.

**Threshold.** `OUTLIER_THRESHOLD = 0.01` (1%).

| | |
|---|---|
| Mislabel cases observed | 0.001%–0.01% of the best output (orders of magnitude off) |
| Worst plausible legitimate spread | ~50% (fixed-fee provider on a tiny swap + bad slippage) |
| Threshold of 1% | sits clearly between the two — catches every mislabel case, never clips a legitimate-but-bad route |

The filter only runs when ≥2 providers returned a quote (no single-quote false positives — without a reference there's nothing to compare against). Filtered providers move from `quotes` to `failed` with reason `"no compatible route for this token pair"`. A `console.warn` line is emitted for observability:

```
[quotes] dropping across: output 0.020 is 0.004% of best (496.897). Likely same-asset-bridge mislabel.
```

---

## Scripts

```bash
npm run dev      # tsx watch — hot-reload on file changes
npm run build    # tsc to dist/
npm start        # node dist/index.js
```
