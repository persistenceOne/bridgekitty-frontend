<div align="center">

# BridgeKitty

**Cross-chain swap aggregator. Best quote, every time. Works for humans and AI agents.**

[![Live](https://img.shields.io/badge/live-bridgekitty.xyz-E59636?style=flat-square)](https://bridgekitty.xyz)
[![MCP Server](https://img.shields.io/badge/MCP-mcp.bridgekitty.xyz-633C0D?style=flat-square)](https://mcp.bridgekitty.xyz/health)
[![API](https://img.shields.io/badge/API-api.bridgekitty.xyz-350B00?style=flat-square)](https://api.bridgekitty.xyz/api/health)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

Built by [Persistence](https://persistence.one)

</div>

---

BridgeKitty is a cross-chain swap aggregator. Pick a token on one chain, pick where you want it to land, and BridgeKitty fetches quotes from four routing providers in parallel — LI.FI, Squid Router, deBridge, and Relay — and shows you the best one. No account, no sign-up. Connect your wallet and swap.

It also ships with a full MCP server so AI agents (Claude, GPT, Gemini) can do the same thing programmatically.

---

## What it does

### Swapping

BridgeKitty compares quotes from **LI.FI, Squid Router, deBridge, and Relay** simultaneously and surfaces the route with the best output and lowest fees. You sign one transaction and it handles the rest.

Cross-chain swaps usually settle in 30 seconds to a few minutes. BridgeKitty polls the bridge status and shows you when funds land.

**Fit gas.** When you're swapping a chain's native asset and your entered amount would leave nothing for fees, a "Fit gas" chip appears. One tap auto-reduces the input by the worst-case gas cost across all quotes (plus a 15% buffer) so the swap goes through instead of failing on submission.

**Safety hardening.** Every provider client validates the recipient before and after fetching a quote — some aggregators silently substitute a fallback wallet when the recipient is the zero address, which has historically cost users real money. BridgeKitty fails closed: the frontend skips quoting before a wallet connects, the backend rejects zero-address requests, and the execution path scans calldata for your address before signing.

### Transaction history

Every swap you make through BridgeKitty is saved to your wallet's history. You can see the status, chains involved, and link out to the block explorer.

---

## Supported chains

| Chain | Chain ID |
|-------|----------|
| Ethereum | 1 |
| Base | 8453 |
| BNB Chain | 56 |
| Polygon | 137 |
| Monad | 143 |

---

## For AI agents

BridgeKitty has a live MCP server that lets any AI agent get swap quotes, check transaction status, and read wallet history — through one endpoint, no API key needed.

**MCP endpoint:** `https://mcp.bridgekitty.xyz/mcp`

### Connecting your agent

**Claude Desktop**

```json
{
  "mcpServers": {
    "bridgekitty": {
      "type": "http",
      "url": "https://mcp.bridgekitty.xyz/mcp"
    }
  }
}
```

**Claude Code**

```bash
claude mcp add --transport http bridgekitty https://mcp.bridgekitty.xyz/mcp
```

**Any HTTP agent**

```bash
curl -X POST https://mcp.bridgekitty.xyz/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

### Tools

| Tool | What it does |
|------|-------------|
| `check_health` | Check the backend and database are online |
| `register_wallet` | Register a wallet at the start of a session |
| `get_swap_quote` | Get a cross-chain quote from LI.FI, Squid, deBridge, or Relay |
| `get_transaction_status` | Poll a bridge or swap until it completes or fails |
| `get_transaction_history` | Fetch a wallet's past swaps |
| `record_transaction` | Save a swap after the user signs it |
| `get_protocol_stats` | Get swap volume and unique user stats |

### How wallet signing works

Agents can't sign transactions. Only the user's wallet can.

1. Agent calls `get_swap_quote` and gets back a `transactionRequest` payload
2. Agent shows the user what they're about to do: destination amount, fees, ETA
3. User signs in their wallet. The agent never sees the private key
4. Wallet returns a `txHash`. Agent calls `record_transaction` and polls `get_transaction_status` until the bridge settles

Agents plan and track. Users sign. Nothing moves without wallet confirmation.

---

## Tech stack

**Frontend** React 18, Vite, TypeScript, Tailwind CSS, Framer Motion, Privy

**Backend** Express, MongoDB, Mongoose, TypeScript, Zod

**MCP server** @modelcontextprotocol/sdk, TypeScript, Node 18+

**Routing providers** LI.FI, Squid Router, deBridge, Relay

---

## Project structure

```
bridgekitty/
├── frontend/          Web app (bridgekitty.xyz)
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── lib/
│   └── public/
│
├── backend/           REST API (api.bridgekitty.xyz)
│   └── src/
│       ├── routes/
│       ├── models/
│       └── lib/
│
└── mcp/               MCP server (mcp.bridgekitty.xyz)
    └── src/
        ├── tools/
        ├── resources/
        └── prompts/
```

---

## Running locally

You need Node 18+ and a running MongoDB instance.

**Backend**

```bash
cd backend
npm install
cp .env.example .env   # fill in LIFI_API_KEY and SQUID_INTEGRATOR_ID
npm run dev
# http://localhost:8080
```

**Frontend**

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
# http://localhost:5173
```

**MCP server**

```bash
cd mcp
npm install
npm run build
npm start              # stdio mode
npm run start:http     # HTTP mode → http://localhost:3100/mcp
```

---

## Environment variables

**Backend**

```env
PORT=8080
CORS_ORIGIN=http://localhost:5173
MONGODB_URI=mongodb://localhost:27017/bridgekitty

LIFI_API_KEY=               # required — get one at li.quest
LIFI_API_BASE_URL=https://li.quest/v1
LIFI_INTEGRATOR=BridgeKitty

SQUID_API_BASE_URL=https://v2.api.squidrouter.com
SQUID_INTEGRATOR_ID=        # pre-registered with Squid
```

**Frontend**

```env
VITE_PRIVY_APP_ID=                             # Privy app ID for wallet auth
VITE_BRIDGEKITTY_API_BASE_URL=http://localhost:8080/api
VITE_ALCHEMY_API_KEY=                          # on-chain balance reads
VITE_COINGECKO_API_KEY=                        # token prices
VITE_CMC_API_KEY=                              # fallback price feed
```

---

## API

Base URL: `https://api.bridgekitty.xyz/api`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Service and database status |
| `POST` | `/wallets` | Register or update a wallet |
| `POST` | `/quotes` | Get a cross-chain swap quote |
| `POST` | `/swaps` | Create a swap record |
| `GET` | `/swaps` | Get swap records for a wallet |
| `POST` | `/transactions` | Record a submitted transaction |
| `GET` | `/transactions` | Get transaction history |
| `GET` | `/status` | Poll a transaction's bridge status |
| `GET` | `/stats` | Protocol analytics |

---

## Privacy

No email, phone number, or personal data collected. The only things stored are your wallet address (already public on-chain) and swap records. Blockchain transactions are permanent and visible to anyone.

---

<div align="center">

[bridgekitty.xyz](https://bridgekitty.xyz) · [mcp.bridgekitty.xyz](https://mcp.bridgekitty.xyz/health) · Built by [Persistence](https://persistence.one)

</div>
