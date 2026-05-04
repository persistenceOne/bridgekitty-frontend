<div align="center">

# BridgeKitty Demo

**Cross-chain swap aggregator demo. Best quote, every time.**

[![Live](https://img.shields.io/badge/live-bridgekitty.persistence.one-E59636?style=flat-square)](https://bridgekitty.persistence.one)
[![Demo](https://img.shields.io/badge/demo-bridgekittydemo.vercel.app-E59636?style=flat-square)](https://bridgekittydemo.vercel.app)
[![API](https://img.shields.io/badge/API-api.bridgekitty.persistence.one-350B00?style=flat-square)](https://api.bridgekitty.persistence.one/api/v1/health)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

Built by [Persistence](https://persistence.one)

</div>

---

BridgeKitty is a cross-chain swap aggregator. Pick a token on one chain, pick where you want it to land, and BridgeKitty fetches quotes from seven routing providers — **LI.FI, Squid Router, deBridge, Relay, Across, Symbiosis, and Meson** — and shows you the best one. No account, no sign-up. Connect your wallet and swap.

This repo is the demo frontend. It talks **directly** to the BridgeKitty backend at `https://api.bridgekitty.persistence.one/api/v1` — no local proxy needed. The full integration spec is in [`bridgekitty-backend/docs/integration_bridgekitty.md`](https://github.com/persistenceOne/bridgekitty-backend/blob/main/docs/integration_bridgekitty.md).

**Where it runs**

| Environment | URL |
|---|---|
| Production | [bridgekitty.persistence.one](https://bridgekitty.persistence.one) |
| Demo | [bridgekittydemo.vercel.app](https://bridgekittydemo.vercel.app) |
| Local dev | http://localhost:5173 |
| BridgeKitty API | `https://api.bridgekitty.persistence.one/api/v1` |

---

## Architecture

Two components: a React frontend and the BridgeKitty backend (operated by Persistence). No middle proxy.

```
┌─────────────────┐     POST /quote        ┌──────────────────────────┐
│   Frontend      │ ─────────────────────▶ │  BridgeKitty backend     │
│  (React+Vite)   │     POST /execute      │                          │
│                 │     GET  /status/:id   │  api.bridgekitty.        │
│ bridgekittydemo │     POST /wallets      │   persistence.one        │
│ .vercel.app     │     POST /swaps        │                          │
│                 │     GET  /stats        │  Aggregates 7 providers: │
└─────────────────┘                        │  LI.FI · Squid · deBridge│
       │                                   │  Relay · Across ·        │
       │                                   │  Symbiosis · Meson       │
       │  user's wallet signs tx directly  └──────────────────────────┘
       ▼
   ┌───────────┐
   │  Wallet   │
   │ (MetaMask │
   │  /Privy)  │
   └───────────┘
```

The frontend ([`frontend/`](frontend/)) handles wallet auth (Privy), draft state, balance reads (Alchemy + public RPC fallbacks), and the swap UI. Every API call goes straight to the BridgeKitty backend.

The backend lives in a separate repo and is operated by Persistence. It provides aggregated quotes, builds executable transactions, polls bridge status, and persists swap/wallet/stats records — all integrators (this demo, the MCP server, anyone else) share the same routing engine and stats pool.

---

## How it works

1. **You connect a wallet** (any EVM wallet via Privy). The frontend registers it with `POST /wallets`.
2. **You pick** a source chain + token, a destination chain + token, and an amount.
3. **The frontend calls `POST /quote`** — one HTTP round-trip — and receives all eligible provider quotes ranked by your preference (cheapest by default).
4. **You click "Bridge now"** on the quote you want. The frontend calls `POST /execute` with the `quoteId` to get the unsigned transaction.
5. **Defence-in-depth**: the frontend scans the calldata to verify the recipient is your wallet (the backend already does this, but two layers is fine).
6. **Your wallet signs and broadcasts** the transaction. The backend never sees a private key.
7. **The frontend records the swap** with `POST /swaps` (which also upserts to transaction history) and polls `GET /status/:trackingId` until the bridge completes.
8. **Funds land on the destination chain.** The receipt is queryable via `GET /transactions?userAddress=...`.

Cross-chain swaps usually settle in 30 seconds to a few minutes depending on the route.

---

## Supported chains

| Chain | Chain ID | Native asset |
|-------|---------:|--------------|
| Ethereum | 1 | ETH |
| Base | 8453 | ETH |
| BOB | 60808 | ETH |
| BNB Chain | 56 | BNB |
| Monad | 143 | MON |
| Polygon | 137 | POL |
| Bitlayer | 200901 | BTC |
| B² Network | 223 | BTC |
| Rootstock | 30 | RBTC |
| Core | 1116 | CORE |
| Merlin | 4200 | BTC |

Token list lives in [`frontend/src/lib/chains.ts`](frontend/src/lib/chains.ts).

---

## Running locally

You need **Node 18+**. No backend, no database, no paid API keys are required.

### 1. Clone and install

```bash
git clone https://github.com/<your-fork>/bridgekittydemo.git
cd bridgekittydemo/frontend
npm install
```

### 2. Configure env

```bash
cp .env.production.example .env
```

The default `VITE_BRIDGEKITTY_API_BASE_URL` points at production (`https://api.bridgekitty.persistence.one/api/v1`). Optionally set `VITE_PRIVY_APP_ID` for real wallet auth — without it a demo wallet handles development.

### 3. Run

```bash
npm run dev
# → http://localhost:5173
```

### Optional credentials

These are not required for the app to function:

| Variable | What it gives you | Where to get it |
|---|---|---|
| `VITE_PRIVY_APP_ID` | Real wallet auth (MetaMask, WalletConnect, embedded wallets) | [dashboard.privy.io](https://dashboard.privy.io) — free tier is fine |
| `VITE_ALCHEMY_API_KEY` | Faster, more reliable balance reads on ETH/Base/Polygon | [alchemy.com](https://alchemy.com) — free tier is fine |

---

## Environment variables

| Variable | Required | Default | What it does |
|---|:---:|---|---|
| `VITE_BRIDGEKITTY_API_BASE_URL` | no | `https://api.bridgekitty.persistence.one/api/v1` | BridgeKitty backend base URL. Override only if running against a staging environment. |
| `VITE_PRIVY_APP_ID` | no | (empty) | Privy app ID for wallet auth. Without it, the app uses a demo-wallet fallback. |
| `VITE_ALCHEMY_API_KEY` | no | (empty) | Alchemy API key for balance reads. Without it, the app falls back to public RPCs. |

---

## API reference

The frontend talks to the BridgeKitty backend at `https://api.bridgekitty.persistence.one/api/v1`. Full docs live in the backend repo: [`bridgekitty-backend/docs/integration_bridgekitty.md`](https://github.com/persistenceOne/bridgekitty-backend/blob/main/docs/integration_bridgekitty.md).

| Method | Path | What it does |
|--------|------|--------------|
| `GET`  | `/health` | Liveness probe |
| `GET`  | `/chains` | List supported chains |
| `GET`  | `/tokens?chainId=X` | Token list for one chain |
| `POST` | `/wallets` | Register/upsert a wallet |
| `POST` | `/quote` | Get all-provider quotes for a swap |
| `POST` | `/execute` | Build the unsigned transaction for a `quoteId` (idempotent) |
| `POST` | `/swaps` | Record a swap (also upserts transaction history when txHash is present) |
| `GET`  | `/swaps?userAddress=&limit=` | Swap records for a wallet |
| `POST` | `/transactions` | Record a signed-and-broadcast transaction |
| `GET`  | `/transactions?userAddress=&limit=` | Transaction history for a wallet |
| `GET`  | `/status/:trackingId` | Poll a bridge/swap until it completes |
| `GET`  | `/stats?period=7d\|15d\|30d\|all` | Cumulative protocol analytics across all integrators |

---

## Project structure

```
bridgekittydemo/
├── README.md                          ← you are here
└── frontend/                          Web app (bridgekittydemo.vercel.app)
    ├── .env.production.example        Annotated env template
    ├── public/                        Static assets, provider logos
    └── src/
        ├── components/                React views (Swap, Agent, Stats, Landing)
        ├── hooks/                     useSwapQuotes, useSwapExecution, etc.
        ├── services/                  quoteService, balanceService, priceService
        ├── lib/                       chains.ts (token registry), swap utilities
        ├── App.tsx                    Root + view orchestration
        ├── constants.ts               LIVE_PROVIDERS, DEBOUNCE_MS, refresh intervals
        ├── types.ts                   Shared TS types
        └── index.css                  Design system
```

---

## Privacy

No email, phone number, or personal data collected. The only things stored are your wallet address (already public on-chain) and swap records associated with it. Blockchain transactions are permanent and visible to anyone.

---

<div align="center">

[bridgekitty.persistence.one](https://bridgekitty.persistence.one) · Built by [Persistence](https://persistence.one)

</div>
