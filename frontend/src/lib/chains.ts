export const NATIVE_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

export type ChainKey =
  | 'base'
  | 'bsc'
  | 'ethereum'
  | 'polygon'
  | 'monad'
  | 'bitlayer'
  | 'merlin'
  | 'core'
  | 'b2-network'
  | 'rootstock'
  | 'bob';

export interface TokenOption {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  logoURI: string;
}

export interface ChainOption {
  key: ChainKey;
  name: string;
  chainId: number;
  logoURI: string;
  tokens: TokenOption[];
}

// ── Ethereum ─────────────────────────────────────────────
const ETHEREUM_TOKENS: TokenOption[] = [
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    decimals: 6,
    logoURI: '/token-icons/usdc.svg'
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    decimals: 6,
    logoURI: '/token-icons/usdt.svg'
  },
  {
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    decimals: 18,
    logoURI: '/token-icons/dai.svg'
  },
  {
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    decimals: 8,
    logoURI: '/token-icons/wbtc.png'
  }
];

// ── Base ──────────────────────────────────────────────────
const BASE_TOKENS: TokenOption[] = [
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    decimals: 6,
    logoURI: '/token-icons/usdc.svg'
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    address: '0xfde4C96c8593536e31F229EA8f37b2Ada2699bb2',
    decimals: 6,
    logoURI: '/token-icons/usdt.svg'
  },
  {
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
    decimals: 18,
    logoURI: '/token-icons/dai.svg'
  },
  {
    symbol: 'cbBTC',
    name: 'Coinbase Wrapped BTC',
    address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
    decimals: 8,
    logoURI: '/token-icons/cbbtc.png'
  }
];

// ── BNB Chain ─────────────────────────────────────────────
const BSC_TOKENS: TokenOption[] = [
  {
    symbol: 'USDT',
    name: 'Tether USD',
    address: '0x55d398326f99059fF775485246999027B3197955',
    decimals: 18,
    logoURI: '/token-icons/usdt.svg'
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    decimals: 18,
    logoURI: '/token-icons/usdc.svg'
  },
  {
    symbol: 'BTCB',
    name: 'Binance-Peg BTCB Token',
    address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',
    decimals: 18,
    logoURI: '/token-icons/btcb.png'
  }
];

// ── Polygon ───────────────────────────────────────────────
const POLYGON_TOKENS: TokenOption[] = [
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    decimals: 6,
    logoURI: '/token-icons/usdc.svg'
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    decimals: 6,
    logoURI: '/token-icons/usdt.svg'
  },
  {
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    address: '0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6',
    decimals: 8,
    logoURI: '/token-icons/wbtc.png'
  }
];

// ── Monad ─────────────────────────────────────────────────
const MONAD_TOKENS: TokenOption[] = [
  {
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    address: '0x0555E30da8f98308EdB960aa94C0Db47230d2B9c',
    decimals: 8,
    logoURI: '/token-icons/wbtc.png'
  }
];

// ── BTC L2s ───────────────────────────────────────────────
// Tokens sourced from Meson's /api/v1/list?detailed=true and Symbiosis's
// /v1/tokens. Native BTC entries use NATIVE_TOKEN_ADDRESS so the routing
// engine recognizes them.

const BITLAYER_TOKENS: TokenOption[] = [
  { symbol: 'BTC',  name: 'Bitcoin',     address: NATIVE_TOKEN_ADDRESS, decimals: 18, logoURI: '/token-icons/wbtc.png' },
  { symbol: 'USDC', name: 'USD Coin',    address: '0xf8C374CE88A3BE3d374e8888349C7768B607c755', decimals: 6, logoURI: '/token-icons/usdc.svg' },
  { symbol: 'USDT', name: 'Tether USD',  address: '0xfe9f969faf8ad72a83b761138bf25de87eff9dd2', decimals: 6, logoURI: '/token-icons/usdt.svg' }
];

const MERLIN_TOKENS: TokenOption[] = [
  { symbol: 'BTC',  name: 'Bitcoin',     address: NATIVE_TOKEN_ADDRESS, decimals: 18, logoURI: '/token-icons/wbtc.png' },
  // Merlin's USDC/USDT are M-USDC / M-USDT (Meson-bridged variants); routed via Meson backend
  { symbol: 'USDC', name: 'M-USDC',      address: '0xb880fd278198bd590252621d4cd071b1842e9bcd', decimals: 6, logoURI: '/token-icons/usdc.svg' },
  { symbol: 'USDT', name: 'M-USDT',      address: '0x3a01a5f50c8eaf82f2a72ee3a30f44d2f0e9e7e0', decimals: 6, logoURI: '/token-icons/usdt.svg' }
];

const CORE_TOKENS: TokenOption[] = [
  { symbol: 'USDC', name: 'USD Coin',    address: '0xa4151B2B3e269645181dCcF2D426cE75fcbDeca9', decimals: 6, logoURI: '/token-icons/usdc.svg' },
  { symbol: 'USDT', name: 'Tether USD',  address: '0x900101d06A7426441Ae63e9AB3B9b0F63Be145F1', decimals: 6, logoURI: '/token-icons/usdt.svg' }
];

const B2_NETWORK_TOKENS: TokenOption[] = [
  { symbol: 'BTC',  name: 'Bitcoin',     address: NATIVE_TOKEN_ADDRESS, decimals: 18, logoURI: '/token-icons/wbtc.png' },
  { symbol: 'USDC', name: 'USD Coin',    address: '0x6c47db95e8d54daedd58e02e1c0e83b25b7e2e0a', decimals: 6, logoURI: '/token-icons/usdc.svg' },
  { symbol: 'USDT', name: 'Tether USD',  address: '0xb1bb86c3eb1d65a5e72f6c3b8d99e0c9bcf4b4f4', decimals: 6, logoURI: '/token-icons/usdt.svg' }
];

const ROOTSTOCK_TOKENS: TokenOption[] = [
  { symbol: 'RBTC', name: 'Smart Bitcoin', address: NATIVE_TOKEN_ADDRESS, decimals: 18, logoURI: '/chains/rootstock.svg' },
  { symbol: 'WBTC', name: 'Wrapped BTC',   address: '0x542fda317318ebf1d3deaf76e0b632741a7e677d', decimals: 18, logoURI: '/token-icons/wbtc.png' }
];

const BOB_TOKENS: TokenOption[] = [
  { symbol: 'WBTC', name: 'Wrapped Bitcoin', address: '0x03c7054bcb39f7b2e5b2c7acb37583e32d70cfa3', decimals: 8, logoURI: '/token-icons/wbtc.png' },
  { symbol: 'USDC', name: 'USDC.e',      address: '0xe75d0fb2c24a55ca1e3f96781a2bcc7bdba058f0', decimals: 6, logoURI: '/token-icons/usdc.svg' }
];

export const CHAINS: ChainOption[] = [
  {
    key: 'ethereum',
    name: 'Ethereum',
    chainId: 1,
    logoURI: '/token-icons/eth.svg',
    tokens: ETHEREUM_TOKENS
  },
  {
    key: 'base',
    name: 'Base',
    chainId: 8453,
    logoURI: '/chains/base.svg',
    tokens: BASE_TOKENS
  },
  {
    key: 'bsc',
    name: 'BNB Chain',
    chainId: 56,
    logoURI: '/chains/bnb.svg',
    tokens: BSC_TOKENS
  },
  {
    key: 'polygon',
    name: 'Polygon',
    chainId: 137,
    logoURI: '/chains/polygon.svg',
    tokens: POLYGON_TOKENS
  },
  {
    key: 'monad',
    name: 'Monad',
    chainId: 143,
    logoURI: '/chains/monad.png',
    tokens: MONAD_TOKENS
  },
  {
    key: 'bitlayer',
    name: 'Bitlayer',
    chainId: 200901,
    logoURI: '/chains/bitlayer.svg',
    tokens: BITLAYER_TOKENS
  },
  {
    key: 'merlin',
    name: 'Merlin',
    chainId: 4200,
    logoURI: '/chains/merlin.svg',
    tokens: MERLIN_TOKENS
  },
  {
    key: 'core',
    name: 'Core',
    chainId: 1116,
    logoURI: '/chains/core.svg',
    tokens: CORE_TOKENS
  },
  {
    key: 'b2-network',
    name: 'B² Network',
    chainId: 223,
    logoURI: '/chains/b2-network.svg',
    tokens: B2_NETWORK_TOKENS
  },
  {
    key: 'rootstock',
    name: 'Rootstock',
    chainId: 30,
    logoURI: '/chains/rootstock.svg',
    tokens: ROOTSTOCK_TOKENS
  },
  {
    key: 'bob',
    name: 'BOB',
    chainId: 60808,
    logoURI: '/chains/bob.svg',
    tokens: BOB_TOKENS
  }
];

export const CHAIN_BY_KEY: Record<ChainKey, ChainOption> = Object.fromEntries(
  CHAINS.map((chain) => [chain.key, chain])
) as Record<ChainKey, ChainOption>;

export function getToken(chainKey: ChainKey, symbol: string): TokenOption | undefined {
  return CHAIN_BY_KEY[chainKey]?.tokens.find((token) => token.symbol === symbol);
}

export function getDefaultToken(chainKey: ChainKey): TokenOption {
  return CHAIN_BY_KEY[chainKey].tokens[0];
}
