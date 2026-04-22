# BridgeKitty / Backend

REST API for BridgeKitty. Handles swap quotes, transaction tracking, wallet registration, and protocol analytics. Runs at [api.bridgekitty.xyz](https://api.bridgekitty.xyz/api/health).

---

## Tech stack

| | |
|---|---|
| Framework | Express |
| Language | TypeScript |
| Database | MongoDB + Mongoose |
| Validation | Zod |
| Security | Helmet + CORS + express-rate-limit |
| Logging | Morgan |

---

## Running locally

```bash
npm install
cp .env.example .env
npm run dev
# http://localhost:8080
```

MongoDB needs to be running before you start. Either a local instance or point `MONGODB_URI` at an Atlas cluster.

---

## Environment variables

```env
# Server
PORT=8080
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# Database
MONGODB_URI=mongodb://localhost:27017/bridgekitty

# LI.FI — required for swap quotes
LIFI_API_KEY=
LIFI_API_BASE_URL=https://li.quest/v1
LIFI_INTEGRATOR=BridgeKitty

# Squid Router — integrator ID is pre-registered
SQUID_API_BASE_URL=https://v2.api.squidrouter.com
SQUID_INTEGRATOR_ID=
```

**Providers with zero-config defaults.** deBridge (`https://dln.debridge.finance`) and Relay (`https://api.relay.link`) don't need env vars to run locally — base URLs are hardcoded defaults in `src/config/env.ts`.

**Optional price oracles** (`COINGECKO_API_KEY`, `CMC_API_KEY`) convert deBridge's native-token fee to USD. Without them, quotes still work but the deBridge fee will under-report by the fixed native-fee portion.

---

## API reference

Base URL: `http://localhost:8080/api`

### Health

```
GET /api/health
```

Returns service name and database connection status.

```json
{ "ok": true, "service": "bridgekitty-api", "db": "connected" }
```

---

### Wallets

```
POST /api/wallets
```

Registers a wallet or updates its last-seen timestamp. Safe to call on every session start — it's an upsert.

**Body**
```json
{ "address": "0x..." }
```

---

### Quotes

```
POST /api/quotes?provider=lifi|squid|debridge|relay
```

Fetches a cross-chain swap quote from the specified provider. Returns destination amount, fees, ETA, and a transaction request payload ready to sign.

**Body**
```json
{
  "srcChainKey": "base",
  "dstChainKey": "ethereum",
  "srcTokenAddress": "0x...",
  "dstTokenAddress": "0x...",
  "amount": "1000000",
  "srcWalletAddress": "0x...",
  "dstWalletAddress": "0x..."
}
```

Rate limited to 30 requests/minute per IP in production.

---

### Swaps

```
POST /api/swaps     Create a swap record
GET  /api/swaps     Get swap records for a wallet (?userAddress=&limit=)
```

Persists swap records. Separate from transaction history: swap records are created at quote time, transactions are created after the user signs.

---

### Transactions

```
POST /api/transactions    Record a submitted transaction
GET  /api/transactions    Get transaction history (?userAddress=&limit=)
```

Created after a swap is signed and broadcast. Shows up in the user's history.

---

### Transaction status

```
GET /api/status?txHash=&provider=lifi|squid|debridge|relay&fromChain=&toChain=
```

Polls the bridge provider for the current status of a cross-chain transaction.

Possible statuses: `submitted`, `confirming`, `bridging`, `completed`, `failed`

Returns `receivingTxHash` and `explorerLink` once the bridge completes.

---

### Stats

```
GET /api/stats?period=7d|15d|30d
```

Protocol-wide analytics for the given time window.

```json
{
  "period": "7d",
  "uniqueUsers": 42,
  "swapVolumeUsd": 18500,
  "swapCount": 103
}
```

---

## Database models

### Wallet
Wallet addresses and last-seen timestamps.

| Field | Type | Notes |
|-------|------|-------|
| `address` | String | Unique, lowercase |
| `lastSeenAt` | Date | Updated on each register call |

### SwapRecord
Created when a quote is accepted (before signing).

| Field | Type | Notes |
|-------|------|-------|
| `userAddress` | String | |
| `quoteId` | String | |
| `provider` | String | lifi, squid, debridge, or relay |
| `fromChain` | String | Chain key |
| `toChain` | String | Chain key |
| `fromTokenSymbol` | String | |
| `toTokenSymbol` | String | |
| `amount` | String | Human-readable |
| `volumeUsd` | Number | Optional |
| `txHash` | String | Optional, set after signing |
| `status` | String | Default: quote-created |

### TransactionHistory
Created after a tx is signed and broadcast.

| Field | Type | Notes |
|-------|------|-------|
| `userAddress` | String | Indexed |
| `txHash` | String | Unique per user |
| `provider` | String | |
| `fromChain` | String | |
| `toChain` | String | |
| `fromTokenSymbol` | String | |
| `toTokenSymbol` | String | |
| `amount` | String | |
| `volumeUsd` | Number | Optional |
| `status` | String | Default: submitted |

---

## Source structure

```
src/
├── config/
│   ├── env.ts              Zod-validated environment config
│   └── db.ts               MongoDB connection
├── models/
│   ├── Wallet.ts
│   ├── SwapRecord.ts
│   └── TransactionHistory.ts
├── lib/
│   ├── lifiClient.ts       LI.FI quote client
│   ├── squidClient.ts      Squid Router quote client
│   ├── debridgeClient.ts   deBridge DLN quote client
│   ├── relayClient.ts      Relay Protocol quote client
│   ├── recipientGuard.ts   Recipient validation for all quote clients
│   └── nativePrice.ts      Native-token USD price lookup
├── routes/
│   ├── index.ts
│   ├── health.routes.ts
│   ├── wallets.routes.ts
│   ├── quotes.routes.ts
│   ├── swaps.routes.ts
│   ├── transactions.routes.ts
│   ├── status.routes.ts
│   └── stats.routes.ts
└── index.ts                Express app entry point
```

---

## Scripts

```bash
npm run dev      # start with tsx watch (hot reload)
npm run build    # compile TypeScript to dist/
npm start        # run compiled output
```
