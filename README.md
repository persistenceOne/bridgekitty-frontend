<div align="center">

# BridgeKitty

**Cross-chain swap aggregator. Best quote, every time. Works for humans and AI agents.**

[![Live](https://img.shields.io/badge/live-bridgekitty.persistence.one-E59636?style=flat-square)](https://bridgekitty.persistence.one)
[![Demo](https://img.shields.io/badge/demo-bridgekittydemo.vercel.app-E59636?style=flat-square)](https://bridgekittydemo.vercel.app)
[![API](https://img.shields.io/badge/API-api.bridgekitty.persistence.one-350B00?style=flat-square)](https://api.bridgekitty.persistence.one/api/health)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

Built by [Persistence](https://persistence.one)

</div>

---

BridgeKitty is a cross-chain swap aggregator. Pick a token on one chain, pick where you want it to land, and BridgeKitty fetches quotes from five routing providers — **LI.FI, Squid Router, deBridge, Relay, and Across** — and shows you the best one. No account, no sign-up. Connect your wallet and swap.

It also ships with a full **MCP server** so AI agents (Claude, GPT, Gemini) can do the same thing programmatically.

**Where it runs**

| Environment | URL |
|---|---|
| Production | [bridgekitty.persistence.one](https://bridgekitty.persistence.one) |
| Demo | [bridgekittydemo.vercel.app](https://bridgekittydemo.vercel.app) |
| Local dev | http://localhost:5173 |
| Backend API (production) | `https://api.bridgekitty.persistence.one/api` *(tentative)* |
| Backend API (local) | `http://localhost:8080/api` |

This README is the single end-to-end reference for the project: what it does, how each layer talks to the others, what every environment variable means, every API route's request and response shape, and how to run the whole stack locally. Backend internals live in [`backend/README.md`](backend/README.md); frontend internals live in [`frontend/README.md`](frontend/README.md).

---

## Table of contents

- [How it works](#how-it-works) — the request lifecycle from button click to bridged funds
- [Architecture](#architecture) — three pieces (frontend, backend, Persistence) and what each owns
- [Fees](#fees) — every cost field, where each one comes from, and what we don't show
- [Supported chains](#supported-chains)
- [For AI agents (MCP)](#for-ai-agents)
- [Running locally](#running-locally) — full step-by-step, including credentials
- [Environment variables](#environment-variables) — annotated, every key explained
- [API reference](#api-reference) — every backend route with request/response shapes
- [Project structure](#project-structure)
- [Privacy](#privacy)

---

## How it works

1. **You connect a wallet** (any EVM wallet via Privy). The address is the only identity used.
2. **You pick** a source chain + token, a destination chain + token, and an amount.
3. **The frontend sends ONE request** to the BridgeKitty backend asking "give me the best quote from every supported provider for this swap".
4. **The backend** validates the request, then makes ONE call to the upstream Persistence BridgeKitty API. Persistence returns every provider's quotes in a single response.
5. **The backend picks the best quote per provider** (cheapest by total fee USD), then in parallel calls Persistence's `/execute` endpoint for each — getting back the unsigned transaction calldata.
6. **The backend applies a sanity filter** that drops outlier quotes (anything below 1% of the best provider's output amount — see [the safety rails section](#safety-rails)).
7. **The backend responds** with a single JSON payload: `{ quotes: { lifi, debridge, ... }, failed: { squid: 'no route', ... } }`.
8. **The frontend renders** only the providers that returned a quote, sorted with the best route first.
9. **You click "Bridge now"**. The frontend scans the calldata to verify the recipient is your wallet (defense-in-depth — Persistence already validates this, but we re-check on the device that's about to sign).
10. **Your wallet signs and broadcasts** the transaction. The backend never sees a private key.
11. **The frontend records the transaction** with the backend (which proxies to Persistence) and polls `/api/status` every few seconds until the bridge completes.
12. **Funds land on the destination chain.** Done. The receipt is saved to your wallet's history (only your wallet address + tx hashes — no PII).

Cross-chain swaps usually settle in 30 seconds to a few minutes depending on the route.

---

## Architecture

Three components, each with a single responsibility:

```
┌─────────────────┐      one HTTP call      ┌──────────────────┐      one HTTP call      ┌─────────────────────────┐
│   Frontend      │  ────────────────────▶  │   Backend        │  ────────────────────▶  │  Persistence            │
│  (React+Vite)   │  ◀────────────────────  │  (Express proxy) │  ◀────────────────────  │  BridgeKitty API        │
│                 │   {quotes, failed}      │                  │   all-provider quotes   │                         │
│ bridgekitty.    │                         │ api.bridgekitty. │                         │ api.bridgekitty.        │
│  persistence.one│                         │  persistence.one │                         │   persistence.one       │
└─────────────────┘                         └──────────────────┘                         └─────────────────────────┘
       │                                            │                                                │
       │  user's wallet signs tx directly           │                                                │
       │  (frontend never sends keys to backend)    │                                                │
       ▼                                                                                             │
   ┌───────────┐                                                                                     │
   │  Wallet   │                                                                                     │
   │ (MetaMask │                                                                                     │
   │  /Privy)  │                                                                                     │
   └───────────┘                                                                                     │
                                                                                                     │
                                                                              aggregates all 5 providers:
                                                                              LI.FI · Squid · deBridge · Relay · Across
```

**Frontend** ([`frontend/`](frontend/)) handles wallet auth (Privy), draft state, balance reads (Alchemy + public RPC fallbacks), price reads (CoinGecko/CMC), and the swap UI. **One** call per quote round to the backend.

**Backend** ([`backend/`](backend/)) is a thin Express proxy. It validates input, applies CORS + rate limits, dedupes upstream calls, runs the sanity filter, and forwards the rest to Persistence. **No database.** No private keys. No third-party SDKs — just `fetch` + Zod.

**Persistence BridgeKitty API** is the upstream that does the actual provider aggregation. It lives at `api.bridgekitty.persistence.one/api/v1` and is operated by Persistence. The reason this layer exists is so every BridgeKitty integrator (this app, the MCP server, and anyone else who wants to plug in) shares the same routing engine, the same provider list, the same safety guards, and the same fee plumbing.

The **MCP server** (`[INSERT LINK]`) lives in a separate repo and talks directly to the Persistence API — it does **not** go through the backend in this repo.

### Why the backend exists at all

Since Persistence does the routing, why have an Express layer in the middle? Five reasons:

1. **Same-origin API surface** for the frontend. The browser sees `bridgekitty.persistence.one/api/...` — no cross-origin headaches, simple CORS rules.
2. **Rate limiting** per IP (30 quotes/min in production) so a single client can't abuse Persistence on our behalf.
3. **Input validation** with Zod-ish guards before requests leave our network. Bad amounts, malformed addresses, mismatched destination wallets all get a 400 from us, not Persistence.
4. **Quote-shape unification.** Persistence returns every provider's quotes in one response. Our backend (a) fans out the `/execute` calls per provider, (b) normalizes the result into the frontend's expected shape, and (c) applies the sanity filter that drops mislabeled outliers (see [Safety rails](#safety-rails)).
5. **Fee plumbing.** When/if BridgeKitty starts charging a fee, the backend is where it shows up in the response. Today it's `0` on every provider — see [Fees](#fees).

---

## Fees

BridgeKitty shows one headline number — the all-in USD cost of the swap — and breaks out the parts that matter for deBridge. Every cost field comes straight from Persistence's `feeBreakdown`; **we don't compute or mark up anything locally**.

| Fee | Applies to | Where it goes | Field on the wire |
|---|---|---|---|
| **Network / gas** | Every swap | The destination chain | `feeBreakdown.gasCostUsd` |
| **Provider routing** | Every swap | LI.FI / Squid / deBridge / Relay / Across protocols and their routers | rolled into `feeBreakdown.totalFeeUsd` |
| **DLN solver fee** | deBridge only | The deBridge DLN solver network — paid in the source chain's native token as extra `msg.value` on top of the swap | `feeBreakdown.fixFeeUsd` (USD) + `feeBreakdown.fixFeeNativeRaw` (raw wei) |
| **BridgeKitty fee** | Every swap | Us. **Currently `$0` — every provider, every pair.** | `feeBreakdown.integratorFeeUsd` |

The frontend renders **one summary row** with `formatUsd(feeUsd)` plus a small "Free ✓" line for the BridgeKitty-fee field. Expanding a provider row shows the breakdown above.

### How the BridgeKitty fee works

We don't touch user funds directly. When a fee is configured, it's routed through Persistence's integrator-fee field (`feeBreakdown.integratorFeeUsd`) — the same mechanism Persistence uses for every integrator on the platform.

- **Backend** (`backend/src/routes/quotes.routes.ts`) reads `feeBreakdown.integratorFeeUsd` and surfaces it in the response only when it's > 0. When zero, the field is omitted.
- **Frontend** (`SwapView.tsx`) renders the row as `formatUsd(integratorFeeUsd)` when present, and `Free ✓` otherwise.
- Flipping the fee on or off is a Persistence configuration change. **No BridgeKitty deploy is required.** When Persistence enables a fee for our integrator key, the next quote-refresh round automatically reflects it.

### What we deliberately don't show you

- **`feeBreakdown.protocolFeeUsd`** — for deBridge this is `fixFeeUsd + operatingExpense`. We prefer the explicit `fixFeeUsd` so the "DLN solver fee" line matches what the user is actually charged for the solver. For other providers it's already covered by `totalFeeUsd`.
- **`feeBreakdown.operatingExpenseRaw`** — the DLN solver's margin (deBridge-specific). It funds the solver network, not BridgeKitty. It's already included in the headline `feeUsd`, and because no other provider exposes an equivalent, we don't break it out — the display stays uniform across all five providers.
- **`feeBreakdown.integratorFeePercent`** — always `null` today. We display USD, not percent, to avoid a misleading "<0.01%" badge that doesn't correspond to any real cost.

---

## Safety rails

A misrouted quote could in principle send a user's funds somewhere they don't expect. BridgeKitty is paranoid about this — there are **four independent layers**, and a quote has to pass all four to reach a user's wallet:

1. **Frontend gate.** `useSwapQuotes` skips quoting entirely when no wallet is connected (zero-address recipients can cause some upstream APIs to silently substitute a fallback wallet).
2. **Backend input guard.** Backend rejects:
   - `srcWalletAddress` missing or zero.
   - `dstWalletAddress` non-zero but not equal to `srcWalletAddress` (cross-wallet bridging is not supported).
   - `amount` not matching `^\d+$`.
3. **Backend sanity filter.** Drops any provider quote whose output amount is less than **1% of the best provider's output**. This catches Persistence-side mislabel cases — most notably, Across is a same-asset bridge (ETH→ETH, USDC→USDC) and occasionally returns a quote against a cross-asset request that delivers the source token wrapped on the destination chain rather than the requested destination token. The mislabeled quote claims to deliver the requested asset but actually delivers something else; its output amount is orders of magnitude lower than the legitimate cross-asset quotes, so the 1% threshold catches it cleanly without ever clipping a legitimately-bad-but-real route.
4. **Frontend calldata scan.** Right before `eth_sendTransaction`, `useSwapExecution` scans the unsigned calldata for the connected wallet's address. If the wallet address isn't present in the bytes that are about to be signed, the swap aborts before the wallet popup ever appears.

---

## Supported chains

| Chain | Chain ID | Native asset |
|-------|---------:|--------------|
| Ethereum | 1 | ETH |
| Base | 8453 | ETH |
| BNB Chain | 56 | BNB |
| Polygon | 137 | POL (formerly MATIC) |
| Monad | 143 | MON |

Adding a new chain requires a Persistence-side addition first, then chain-id wiring in [`backend/src/routes/quotes.routes.ts`](backend/src/routes/quotes.routes.ts) (`CHAIN_ID_BY_KEY`), and a token list update in [`frontend/src/lib/chains.ts`](frontend/src/lib/chains.ts).

---

## For AI agents

BridgeKitty has a live MCP server that lets any AI agent get swap quotes, check transaction status, and read wallet history — through one endpoint, no API key needed.

**MCP endpoint:** `[INSERT LINK]`

### Connecting your agent

**Claude Desktop**

```json
{
  "mcpServers": {
    "bridgekitty": {
      "type": "http",
      "url": "[INSERT LINK]"
    }
  }
}
```

**Claude Code**

```bash
claude mcp add --transport http bridgekitty [INSERT LINK]
```

**Any HTTP agent**

```bash
curl -X POST [INSERT LINK] \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

### Tools

| Tool | What it does |
|------|-------------|
| `check_health` | Check the backend and Persistence upstream are online |
| `register_wallet` | Register a wallet at the start of a session |
| `get_swap_quote` | Get a cross-chain quote from LI.FI, Squid, deBridge, Relay, or Across |
| `get_transaction_status` | Poll a bridge or swap until it completes or fails |
| `get_transaction_history` | Fetch a wallet's past swaps |
| `record_transaction` | Save a swap after the user signs it |
| `get_protocol_stats` | Get swap volume and unique user stats |

### How wallet signing works

Agents can't sign transactions. Only the user's wallet can.

1. Agent calls `get_swap_quote` and gets back a `transactionRequest` payload.
2. Agent shows the user what they're about to do: destination amount, fees, ETA.
3. User signs in their wallet. The agent never sees the private key.
4. Wallet returns a `txHash`. Agent calls `record_transaction` and polls `get_transaction_status` until the bridge settles.

Agents plan and track. Users sign. Nothing moves without wallet confirmation.

---

## Running locally

You need **Node 18+**. No database. No paid API keys are required to make the app work — the optional keys below only improve UX (faster balance reads, better price feeds).

### 1. Clone

```bash
git clone https://github.com/<your-fork>/bridgekitty.git
cd bridgekitty
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
# Defaults are fine for local dev — no editing needed.
npm run dev
# → http://localhost:8080
```

Verify it's up:

```bash
curl http://localhost:8080/api/health
# {"ok":true,"service":"bridgekitty-api","upstream":"connected"}
```

If `upstream: "disconnected"`, the backend is up but can't reach Persistence — check your network. Quote routes will return `502` until it recovers.

### 3. Frontend

In a new terminal:

```bash
cd frontend
npm install
cp .env.example .env
# Optionally set VITE_PRIVY_APP_ID for real wallet auth.
# Without it, a demo wallet handles development.
npm run dev
# → http://localhost:5173
```

Open `http://localhost:5173` in a browser. You should see the landing page; pick "Human" to enter the swap UI.

### Optional credentials

These are not required for the app to function:

| Variable | What it gives you | Where to get it |
|---|---|---|
| `VITE_PRIVY_APP_ID` | Real wallet auth (MetaMask, WalletConnect, embedded wallets) | [dashboard.privy.io](https://dashboard.privy.io) — free tier is fine |
| `VITE_ALCHEMY_API_KEY` | Faster, more reliable balance reads on ETH/Base/Polygon | [alchemy.com](https://alchemy.com) — free tier is fine |
| `VITE_COINGECKO_API_KEY` | Token USD prices (primary) | [coingecko.com/en/api](https://www.coingecko.com/en/api) — demo key works |
| `VITE_CMC_API_KEY` | Token USD prices (fallback if CoinGecko rate-limits) | [pro.coinmarketcap.com](https://pro.coinmarketcap.com) — sandbox/free fine |

Without these the app still works, just slower for balances and slightly less accurate for prices. **No credentials are needed for the routing/quoting/swapping path itself** — Persistence requires no integrator auth header.

---

## Environment variables

### Backend (`backend/.env`)

| Variable | Required | Default | What it does |
|---|:---:|---|---|
| `NODE_ENV` | yes | `development` | When `production`: enables rate limiting, hides verbose errors, locks CORS to `CORS_ORIGIN`. |
| `PORT` | yes | `8080` | TCP port the Express app binds to. |
| `CORS_ORIGIN` | yes | `http://localhost:5173` | Comma-separated origin allowlist. Accepts multiple (`http://localhost:5173,https://staging.example.com`). Only enforced when `NODE_ENV=production`; in development all origins are allowed. |
| `PERSISTENCE_API_BASE_URL` | yes | `https://api.bridgekitty.persistence.one/api/v1` | Upstream Persistence API. Override only if you're running against a Persistence staging environment. |

### Frontend (`frontend/.env`)

| Variable | Required | Default | What it does |
|---|:---:|---|---|
| `VITE_BRIDGEKITTY_API_BASE_URL` | yes | `http://localhost:8080/api` | Where the frontend sends quote/wallet/swap/status calls. In production this is `https://api.bridgekitty.persistence.one/api`. |
| `VITE_PRIVY_APP_ID` | no | (empty) | Privy app ID for wallet auth. Without it, the app uses a demo-wallet fallback so you can develop without creating a Privy account. |
| `VITE_ALCHEMY_API_KEY` | no | (empty) | Alchemy API key for on-chain balance reads on ETH/Base/Polygon. Without it, the app falls back to public RPCs (slower, sometimes rate-limited). |
| `VITE_COINGECKO_API_KEY` | no | (empty) | CoinGecko demo key for USD price lookups. Without it, anonymous CoinGecko works (more aggressive rate limits). |
| `VITE_CMC_API_KEY` | no | (empty) | CoinMarketCap key. Used as a fallback if CoinGecko is unavailable. |
| `VITE_BRIDGEKITTY_QUOTE_PROXY_URL` | no | (empty) | Optional override that bypasses `VITE_BRIDGEKITTY_API_BASE_URL` for the quotes endpoint specifically. Useful if you want quotes routed through a different proxy than the rest of the API. |

---

## API reference

Base URL (production): `https://api.bridgekitty.persistence.one/api`
Base URL (local):      `http://localhost:8080/api`

All requests/responses are JSON. Every route is implemented in [`backend/src/routes/`](backend/src/routes/). Most routes are thin proxies to the corresponding Persistence endpoint; `/quotes` is the one route that does meaningful work locally (fan-out, sanity filter, response normalization).

| Method | Path | What it does | Source |
|--------|------|--------------|--------|
| `GET`  | `/health` | Liveness + Persistence upstream reachability | [health.routes.ts](backend/src/routes/health.routes.ts) |
| `GET`  | `/chains` | List supported chains (proxies Persistence `/chains`) | [chains.routes.ts](backend/src/routes/chains.routes.ts) |
| `GET`  | `/tokens?chainId=X` | Token list for one chain (proxies Persistence `/tokens`) | [tokens.routes.ts](backend/src/routes/tokens.routes.ts) |
| `POST` | `/wallets` | Register/upsert a wallet (proxies Persistence `/wallets`) | [wallets.routes.ts](backend/src/routes/wallets.routes.ts) |
| `POST` | `/quotes` | **Get all-provider quotes for a swap, including unsigned tx calldata.** Single round-trip; backend does the fan-out + sanity filter. | [quotes.routes.ts](backend/src/routes/quotes.routes.ts) |
| `POST` | `/swaps` | Record a swap at quote-acceptance (proxies Persistence `/swaps`) | [swaps.routes.ts](backend/src/routes/swaps.routes.ts) |
| `GET`  | `/swaps?userAddress=&limit=` | Get swap records for a wallet | [swaps.routes.ts](backend/src/routes/swaps.routes.ts) |
| `POST` | `/transactions` | Record a signed-and-broadcast transaction (proxies Persistence `/transactions`) | [transactions.routes.ts](backend/src/routes/transactions.routes.ts) |
| `GET`  | `/transactions?userAddress=&limit=` | Get transaction history for a wallet | [transactions.routes.ts](backend/src/routes/transactions.routes.ts) |
| `GET`  | `/status?provider=&fromChain=&txHash=` | Poll a bridge/swap until it completes or fails. `provider` is the full Persistence trackingId (e.g. `lifi:0xabc...`). | [status.routes.ts](backend/src/routes/status.routes.ts) |
| `GET`  | `/stats?period=7d\|15d\|30d\|all` | Protocol analytics (volume, unique users, swap count) | [stats.routes.ts](backend/src/routes/stats.routes.ts) |

For exact request/response shapes for every route, see [`backend/README.md`](backend/README.md).

---

## Project structure

```
bridgekitty/
├── README.md                          ← you are here
│
├── frontend/                          Web app (bridgekitty.persistence.one)
│   ├── README.md                      Frontend deep-dive
│   ├── .env.example                   Annotated env template
│   ├── public/                        Static assets, provider logos
│   └── src/
│       ├── components/                React views (Swap, Agent, Stats, Landing)
│       ├── hooks/                     useSwapQuotes, useSwapExecution, etc.
│       ├── services/                  quoteService, balanceService, priceService
│       ├── lib/                       chains.ts (token registry), swap utilities
│       ├── App.tsx                    Root + view orchestration
│       ├── constants.ts               LIVE_PROVIDERS, DEBOUNCE_MS, refresh intervals
│       ├── types.ts                   Shared TS types
│       └── index.css                  Design system
│
└── backend/                           REST API (api.bridgekitty.persistence.one)
    ├── README.md                      Backend deep-dive
    ├── .env.example                   Annotated env template
    └── src/
        ├── config/
        │   └── env.ts                 Zod-validated env config
        ├── lib/
        │   └── persistence.ts         Shared fetch helper for Persistence upstream
        ├── routes/                    One file per top-level resource
        │   ├── index.ts               Mounts every router on /api
        │   ├── health.routes.ts
        │   ├── chains.routes.ts
        │   ├── tokens.routes.ts
        │   ├── wallets.routes.ts
        │   ├── quotes.routes.ts       The interesting one — see backend/README.md
        │   ├── swaps.routes.ts
        │   ├── transactions.routes.ts
        │   ├── status.routes.ts
        │   └── stats.routes.ts
        └── index.ts                   Express app entry point
```

The MCP server (`[INSERT LINK]`) lives in a separate repository and talks directly to the Persistence API.

---

## Privacy

No email, phone number, or personal data collected. The only things stored are your wallet address (already public on-chain) and swap records associated with it. Blockchain transactions are permanent and visible to anyone.

---

<div align="center">

[bridgekitty.persistence.one](https://bridgekitty.persistence.one) · MCP: [INSERT LINK] · Built by [Persistence](https://persistence.one)

</div>
