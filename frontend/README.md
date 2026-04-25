# BridgeKitty / Frontend

The web app. Handles wallet connection, cross-chain swap quotes, and transaction tracking.

| Environment | URL |
|---|---|
| Production | [bridgekitty.persistence.one](https://bridgekitty.persistence.one) |
| Demo | [bridgekittydemo.vercel.app](https://bridgekittydemo.vercel.app) |
| Local dev | http://localhost:5173 |

For the project overview, architecture diagram, and end-to-end flow, see [the root README](../README.md). For the API surface this app talks to, see [`backend/README.md`](../backend/README.md).

---

## Contents

- [Tech stack](#tech-stack)
- [Running locally](#running-locally)
- [Environment variables](#environment-variables)
- [Views](#views)
- [Project structure](#project-structure)
- [Quote flow — what happens when the user types an amount](#quote-flow)
- [Transaction execution flow](#transaction-execution-flow)
- [Supported chains](#supported-chains)
- [Swap safety](#swap-safety)
- [Wallet connection](#wallet-connection)
- [Design system](#design-system)
- [Scripts](#scripts)

---

## Tech stack

| | |
|---|---|
| Framework | React 18 + Vite |
| Language | TypeScript |
| Styling | Tailwind CSS + custom CSS design system (`hf-` prefix) |
| Animations | Framer Motion |
| Wallet auth | Privy (optional — falls back to a demo wallet for local dev) |
| Icons | Lucide React |
| State | Local React state. No Redux, Zustand, or persistent store. |
| Routing | None — single-page app with view switching via React state. |

---

## Running locally

```bash
npm install
cp .env.example .env
npm run dev
# → http://localhost:5173
```

**Make sure the backend is running on `http://localhost:8080` before starting the frontend.** See [`backend/README.md`](../backend/README.md#running-locally).

---

## Environment variables

```env
# Wallet auth — required for real Privy login. Leave empty to use the demo-wallet fallback.
VITE_PRIVY_APP_ID=

# BridgeKitty backend (the Express API in this repo)
VITE_BRIDGEKITTY_API_BASE_URL=http://localhost:8080/api

# On-chain balance reads — speeds up balance fetching on ETH/Base/Polygon
VITE_ALCHEMY_API_KEY=

# Token USD pricing (CoinGecko primary, CoinMarketCap fallback — both optional)
VITE_COINGECKO_API_KEY=
VITE_CMC_API_KEY=

# Optional — direct /quotes proxy override. Leave blank to use VITE_BRIDGEKITTY_API_BASE_URL.
VITE_BRIDGEKITTY_QUOTE_PROXY_URL=
```

| Variable | Required | Default | What it does |
|---|:---:|---|---|
| `VITE_BRIDGEKITTY_API_BASE_URL` | yes | `http://localhost:8080/api` | Where the frontend sends quote/wallet/swap/status calls. In production this is `https://api.bridgekitty.persistence.one/api`. |
| `VITE_PRIVY_APP_ID` | no | (empty) | Privy app ID for wallet auth. Without it, the app uses a demo-wallet fallback so you can develop without creating a Privy account. Get one from [dashboard.privy.io](https://dashboard.privy.io). |
| `VITE_ALCHEMY_API_KEY` | no | (empty) | Alchemy API key for on-chain balance reads on Ethereum, Base, and Polygon. Without it, the app falls back to public RPCs (slower, sometimes rate-limited). BNB Chain and Monad always use public RPCs (Alchemy doesn't cover them). Get one from [alchemy.com](https://alchemy.com). |
| `VITE_COINGECKO_API_KEY` | no | (empty) | CoinGecko demo key for USD price lookups. Without it, anonymous CoinGecko works (more aggressive rate limits). |
| `VITE_CMC_API_KEY` | no | (empty) | CoinMarketCap key. Used as a fallback if CoinGecko is unavailable. |
| `VITE_BRIDGEKITTY_QUOTE_PROXY_URL` | no | (empty) | Optional override that bypasses `VITE_BRIDGEKITTY_API_BASE_URL` for the quotes endpoint specifically. Useful if you want quotes routed through a different proxy than the rest of the API. |

---

## Views

Single-page app. All views are React state, no URL routing.

| View | What it does |
|------|-------------|
| **Landing** ([`LandingView.tsx`](src/components/LandingView.tsx)) | Entry point. Pick Human or Agent mode. |
| **Swap** ([`SwapView.tsx`](src/components/SwapView.tsx)) | Cross-chain swap interface. Compares quotes from LI.FI, Squid, deBridge, Relay, and Across via a single backend call. Shows fees, ETA, expandable per-route detail (DLN solver fee, min received, rate, ETA, via). Supports MAX, 50%, and "Fit gas" amount shortcuts. |
| **Agent** ([`AgentView.tsx`](src/components/AgentView.tsx)) | MCP server docs. Setup guides for Claude Desktop, Claude Code, and any HTTP agent. |
| **Stats** ([`StatsView.tsx`](src/components/StatsView.tsx)) | Protocol analytics. Swap volume and unique users over 7/15/30/all-time periods. |

---

## Project structure

```
src/
├── components/
│   ├── LandingView.tsx              Entry point, mode picker
│   ├── SwapView.tsx                 Main swap interface
│   ├── AgentView.tsx                MCP docs and setup guides
│   ├── StatsView.tsx                Protocol analytics dashboard
│   ├── WalletConnector.tsx          Privy + demo-wallet fallback
│   ├── TokenSelector.tsx            Chain + token picker modal
│   ├── TransactionHistoryModal.tsx  Past swaps + bridges modal
│   └── AppProviders.tsx             Privy/wagmi/etc. provider tree
│
├── hooks/
│   ├── useSwapQuotes.ts             Fetches all-provider quotes via ONE backend call
│   ├── useSwapExecution.ts          Calldata sanity check + signing + submission
│   ├── useTokenBalances.ts          On-chain token balances (Alchemy + public RPC fallback)
│   ├── useTransactionHistory.ts     Past-swap fetcher
│   └── usePrices.ts                 USD prices (CoinGecko + CMC fallback)
│
├── services/
│   ├── quoteService.ts              `getAllSwapQuotes` — single call to /api/quotes
│   ├── transactionStatusService.ts  Polls /api/status until completed/failed
│   ├── transactionHistoryService.ts Fetches /api/transactions
│   ├── priceService.ts              Token USD price lookups
│   └── balanceService.ts            On-chain balance fetching with RPC fallbacks
│
├── lib/
│   ├── chains.ts                    Supported networks, token registry
│   ├── swap.ts                      Validation, calldata recipient scan
│   ├── amount.ts                    Wei ⇆ human-readable conversions
│   ├── erc20.ts                     ERC-20 contract helpers (allowance, approve)
│   └── apiBaseUrl.ts                Resolves VITE_BRIDGEKITTY_API_BASE_URL
│
├── types.ts                         Shared TypeScript interfaces
├── constants.ts                     LIVE_PROVIDERS, DEBOUNCE_MS, refresh interval
└── App.tsx                          Root component and view orchestration
```

---

## Quote flow

What happens when the user types an amount, picks tokens, or hits MAX:

```
SwapView.tsx ──── setupAmountDebounce(draft) ────▶ useSwapQuotes
                                                       │
                                                       │  (1000ms debounce on typing,
                                                       │   immediate on MAX/50%/Fit-gas/swap-direction)
                                                       ▼
                                                  fetchQuote(draft)
                                                       │
                                                       │  abort previous round's AbortController,
                                                       │  bump roundRef, set isFetching=true
                                                       ▼
                                       getAllSwapQuotes(request, signal)
                                                       │
                                                       │  ONE POST to /api/quotes
                                                       ▼
                                        ┌────────── backend ──────────┐
                                        │  validates input            │
                                        │  one upstream /quote call   │
                                        │  N parallel /execute calls  │
                                        │  sanity filter              │
                                        └─────────────┬───────────────┘
                                                       │
                                                       ▼
                                       { quotes: { lifi, debridge, ... },
                                         failed: { squid: 'no route', ... } }
                                                       │
                                                       ▼
                                          setQuotes(...) — winners only
                                          setIsFetching(false)
                                          setQuoteCountdown(60s)
                                                       │
                                                       ▼
                              SwapView re-renders — only providers with a
                              quote appear; sorted lowest-fee first; the
                              top one is marked "Best".
```

**Round dedup**: `useSwapQuotes.ts` keeps an `AbortController` ref. When a new round starts, the previous round's controller is `.abort()`-ed, cancelling the old `fetch()` at the network layer. Stale results never make it into state.

**Auto-refresh**: a 60-second countdown starts after every successful round. When it hits zero, `useSwapQuotes` fires a fresh round automatically — keeping the displayed quotes within their TTL. The countdown pauses while the user is mid-execution (`isExecutingRef`).

**Why one backend call?** Persistence's upstream `/quote` returns every provider's quotes in a single response. We fan out the per-provider `/execute` calls on the backend and return everything in one payload. **5 providers, 1 frontend HTTP request, 1 upstream `/quote`, up to 5 upstream `/execute`s.** No race conditions, no `quoteId` collisions, no per-provider HTTP fan-out from the browser.

### Where each row's details come from

When the user expands a route card, the values shown are:

| Row | Source field | Notes |
|---|---|---|
| **Fee** | `pQuote.feeUsd` | From the backend → Persistence `feeBreakdown.totalFeeUsd`. The headline all-in USD cost. |
| **DLN solver fee** *(deBridge only)* | `pQuote.fixFeeUsd` | From `feeBreakdown.fixFeeUsd`. Paid in the source chain's native token as extra `msg.value`. |
| **Route spread** *(deBridge only)* | `feeUsd − fixFeeUsd` | Computed in JSX. The non-solver portion of the deBridge fee. |
| **Min. received** | `pQuote.destinationAmountMin` | From `minOutputAmountRaw`, formatted with the destination token's decimals. |
| **Rate** | `destinationAmount / sourceAmount` | Computed client-side. Shown as `1 SRC ≈ X DST`. |
| **Est. time** | `pQuote.etaSeconds` | From `estimatedTimeSeconds`. Shown as `~Xs`. |
| **Via** | `pQuote.route` | From Persistence's `route` string, e.g. `"ETH → deBridge DLN → MATIC"`. |

The summary box below the route list shows:
- The **DLN solver fee** row (only when `bestQuote.fixFeeUsd > 0`).
- The **BridgeKitty fee** row — `formatUsd(integratorFeeUsd)` when present and > 0, else `Free ✓`. **Today this is always `Free ✓`** because Persistence isn't configured to charge an integrator fee for us. When Persistence flips it on, the next quote round will populate `integratorFeeUsd` and the row switches to the actual amount automatically — **no frontend deploy needed**.

---

## Transaction execution flow

When the user clicks **Bridge now**:

1. **Calldata sanity check** ([`useSwapExecution.ts`](src/hooks/useSwapExecution.ts) → [`swap.ts:validateTransactionRequest`](src/lib/swap.ts)).
   - Reject if `tx.to` is missing or zero.
   - Scan the unsigned `tx.data` calldata for the connected wallet's address. If the address isn't present in the bytes that are about to be signed, abort before the wallet popup ever appears.
2. **ERC-20 approval** (for non-native tokens). If the `srcTokenAddress` isn't native, `ensureTokenApproval` checks the wallet's allowance for the spender (`tx.to`) and fires a separate `approve(...)` transaction first when needed. Native swaps skip this entirely.
3. **`eth_sendTransaction`**. The wallet signs and broadcasts the transaction Persistence built. The frontend never sees the private key.
4. **Record the transaction**. After getting back a `txHash`, the frontend POSTs `/api/swaps` and `/api/transactions` to save the record on the user's wallet history.
5. **Poll status**. `transactionStatusService` calls `/api/status?provider={trackingId}&fromChain={key}&txHash={hash}` every few seconds until the upstream returns `completed` or `failed`. The UI shows a progress strip with five states: `submitted → confirming → bridging → completed` (or `failed`).

---

## Supported chains

| Chain | Chain ID | Native asset |
|-------|---------:|--------------|
| Ethereum | 1 | ETH |
| Base | 8453 | ETH |
| BNB Chain | 56 | BNB |
| Polygon | 137 | POL |
| Monad | 143 | MON |

Tokens are defined in [`src/lib/chains.ts`](src/lib/chains.ts). To add a new token, add an entry there and a CoinGecko/CMC slug mapping in [`priceService.ts`](src/services/priceService.ts).

---

## Swap safety

Four independent guard-rails before the user's wallet is asked to sign — a misrouted quote has to break all four to reach you:

1. **No wallet → no quote.** [`useSwapQuotes.ts`](src/hooks/useSwapQuotes.ts) skips the backend call entirely when no wallet is connected. A zero-address recipient causes some upstream APIs to silently substitute a fallback wallet.
2. **Backend input guard.** Backend rejects zero-address `srcWalletAddress`, mismatched `dstWalletAddress`, or non-numeric `amount` strings (`400`).
3. **Backend sanity filter.** Backend drops any provider quote whose output is less than 1% of the best provider's output. Catches Persistence-side mislabels (notably Across reporting same-asset-bridge quotes against cross-asset requests). See [`backend/README.md`](../backend/README.md#sanity-filter).
4. **Calldata sanity check.** Before `eth_sendTransaction`, [`useSwapExecution.ts`](src/hooks/useSwapExecution.ts) scans tx calldata for the connected wallet's address. If the encoded recipient doesn't match, the swap is aborted.

---

## Wallet connection

Wallet auth uses [Privy](https://privy.io). Set `VITE_PRIVY_APP_ID` to enable it. Without it, a demo wallet handles development.

The wallet address is the only identity used. **No email, password, or personal data is collected** by the frontend or backend. Wallet-address-only.

---

## Design system

Styles live in [`src/index.css`](src/index.css). CSS custom properties for colors, spacing, shadows, fonts, and transitions. All classes are prefixed `hf-`.

Core tokens (Persistence brand palette):

```css
--hf-primary: #E59636        /* Persistence orange */
--hf-text-primary: #1D1306   /* near-black */
--hf-font-headline: 'Poppins'
--hf-font-body: 'Poppins'
--hf-mono: 'JetBrains Mono'
```

Animations are powered by Framer Motion. Tooltips on info icons (`.hf-fee-info-icon .hf-tooltip`) use absolute positioning relative to the icon and sit above their parent. The route-detail drawer toggles `overflow: hidden → visible` via `transitionEnd` so tooltips can escape the drawer once it's fully expanded.

---

## Scripts

```bash
npm run dev      # start dev server with hot reload
npm run build    # production build to dist/
npm run preview  # preview the production build locally
```
