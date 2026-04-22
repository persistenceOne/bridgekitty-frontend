# BridgeKitty / Frontend

The web app. Handles wallet connection, cross-chain swap quotes, and transaction tracking. Runs at [bridgekitty.xyz](https://bridgekitty.xyz).

---

## Tech stack

| | |
|---|---|
| Framework | React 18 + Vite |
| Language | TypeScript |
| Styling | Tailwind CSS + custom CSS design system |
| Animations | Framer Motion |
| Wallet auth | Privy (optional) |
| Icons | Lucide React |

---

## Running locally

```bash
npm install
cp .env.example .env
npm run dev
# http://localhost:5173
```

Make sure the backend is running on `http://localhost:8080` before starting the frontend.

---

## Environment variables

```env
VITE_PRIVY_APP_ID=                             # get from dashboard.privy.io
VITE_BRIDGEKITTY_API_BASE_URL=http://localhost:8080/api
VITE_ALCHEMY_API_KEY=                          # on-chain balance reads
VITE_COINGECKO_API_KEY=                        # token prices (demo key works)
VITE_CMC_API_KEY=                              # fallback if CoinGecko rate-limits
```

If `VITE_PRIVY_APP_ID` is not set, the app falls back to a demo wallet so you can still develop and test without a Privy account.

---

## Views

Single-page app. All views are React state, no URL routing.

| View | What it does |
|------|-------------|
| **Landing** | Entry point. Pick Human or Agent mode. |
| **Swap** | Cross-chain swap interface. Compares quotes from LI.FI, Squid, deBridge, and Relay in parallel. Shows fees, ETA, and a "Fit gas" chip when the input would leave nothing for gas. |
| **Agent** | MCP server docs. Setup guides for Claude Desktop, Claude Code, and HTTP agents. |
| **Stats** | Protocol analytics. Swap volume and unique users over 7/15/30 days. |

---

## Project structure

```
src/
├── components/
│   ├── LandingView.tsx              Entry point, mode picker
│   ├── SwapView.tsx                 Main swap interface
│   ├── AgentView.tsx                MCP docs and setup guides
│   ├── StatsView.tsx                Protocol analytics dashboard
│   ├── WalletConnector.tsx          Privy + demo wallet fallback
│   └── TransactionHistoryModal.tsx  Swap and bridge history modal
│
├── hooks/
│   ├── useSwapQuotes.ts             Fetches and compares quotes from all providers
│   ├── useSwapExecution.ts          Handles swap signing and submission
│   ├── useTokenBalances.ts          Reads on-chain token balances
│   ├── useTransactionHistory.ts     Fetches swap and bridge history
│   └── usePrices.ts                 Token price feeds
│
├── services/
│   ├── quoteService.ts              Calls the backend quote API
│   ├── transactionStatusService.ts  Polls bridge status until resolved
│   ├── transactionHistoryService.ts Fetches transaction records
│   ├── priceService.ts              Token price lookups
│   └── balanceService.ts            On-chain balance fetching
│
├── lib/
│   ├── chains.ts                    Supported networks, tokens, and config
│   ├── swap.ts                      Swap utility functions
│   ├── amount.ts                    Wei and human-readable conversions
│   └── erc20.ts                     ERC-20 contract helpers
│
├── types.ts                         Shared TypeScript interfaces
├── constants.ts                     App-wide constants and config
└── App.tsx                          Root component and view orchestration
```

---

## Supported chains

| Chain | Chain ID |
|-------|----------|
| Ethereum | 1 |
| Base | 8453 |
| BNB Chain | 56 |
| Polygon | 137 |
| Monad | 143 |

Tokens are defined in `src/lib/chains.ts`. To add a new token, add an entry there and a price mapping in `priceService.ts`.

---

## Swap safety

Three independent guard-rails before the user's wallet is asked to sign:

1. **No wallet → no quote.** `useSwapQuotes` skips the backend call entirely when no wallet is connected. A zero-address recipient causes some aggregators to silently substitute a fallback wallet.
2. **Calldata sanity check.** Before `eth_sendTransaction`, `useSwapExecution` scans tx calldata for the connected wallet's address. If the encoded recipient doesn't match, the swap is aborted.
3. **Beta notice.** A small reminder under the swap box keeps expectations honest.

Combined with the backend's `recipientGuard.ts`, a misrouted quote has to break three separate checks to reach your wallet.

---

## Wallet connection

Wallet auth uses [Privy](https://privy.io). Set `VITE_PRIVY_APP_ID` to enable it. Without it, a demo wallet handles development.

No email, password, or personal data collected. Identity is wallet-address only.

---

## Design system

Styles live in `src/index.css`. CSS custom properties for colours, spacing, shadows, fonts, and transitions. All classes are prefixed `hf-`.

Core tokens (Persistence brand palette):

```css
--hf-primary: #E59636        /* Persistence orange */
--hf-text-primary: #1D1306   /* near-black */
--hf-font-headline: 'Poppins'
--hf-font-body: 'Poppins'
--hf-mono: 'JetBrains Mono'
```

---

## Scripts

```bash
npm run dev      # start dev server with hot reload
npm run build    # production build to dist/
npm run preview  # preview the production build locally
```
