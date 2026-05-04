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
    symbol: 'ETH',
    name: 'Ether',
    address: NATIVE_TOKEN_ADDRESS,
    decimals: 18,
    logoURI: '/token-icons/eth.svg'
  },
  {
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    decimals: 8,
    logoURI: '/token-icons/wbtc.png'
  },
  {
    symbol: 'cbBTC',
    name: 'Coinbase Wrapped BTC',
    address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
    decimals: 8,
    logoURI: '/token-icons/cbbtc.png'
  },
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
  }
];

// ── Base ──────────────────────────────────────────────────
const BASE_TOKENS: TokenOption[] = [
  {
    symbol: 'ETH',
    name: 'Ether',
    address: NATIVE_TOKEN_ADDRESS,
    decimals: 18,
    logoURI: '/token-icons/eth.svg'
  },
  {
    symbol: 'cbBTC',
    name: 'Coinbase Wrapped BTC',
    address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
    decimals: 8,
    logoURI: '/token-icons/cbbtc.png'
  },
  {
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    address: '0x0555e30da8f98308edb960aa94c0db47230d2b9c',
    decimals: 8,
    logoURI: '/token-icons/wbtc.png'
  },
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
  }
];

// ── BNB Chain ─────────────────────────────────────────────
const BSC_TOKENS: TokenOption[] = [
  {
    symbol: 'BNB',
    name: 'BNB',
    address: NATIVE_TOKEN_ADDRESS,
    decimals: 18,
    logoURI: '/token-icons/bnb.svg'
  },
  {
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    address: '0x0555e30da8f98308edb960aa94c0db47230d2b9c',
    decimals: 8,
    logoURI: '/token-icons/wbtc.png'
  },
  {
    symbol: 'BTCB',
    name: 'Binance-Peg BTCB Token',
    address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',
    decimals: 18,
    logoURI: '/token-icons/btcb.png'
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    decimals: 18,
    logoURI: '/token-icons/usdc.svg'
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    address: '0x55d398326f99059fF775485246999027B3197955',
    decimals: 18,
    logoURI: '/token-icons/usdt.svg'
  }
];

// ── Polygon ───────────────────────────────────────────────
const POLYGON_TOKENS: TokenOption[] = [
  {
    symbol: 'POL',
    name: 'POL',
    address: NATIVE_TOKEN_ADDRESS,
    decimals: 18,
    logoURI: '/token-icons/matic.svg'
  },
  {
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    address: '0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6',
    decimals: 8,
    logoURI: '/token-icons/wbtc.png'
  },
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
  }
];

// ── Monad ─────────────────────────────────────────────────
const MONAD_TOKENS: TokenOption[] = [
  {
    symbol: 'MON',
    name: 'Monad',
    address: NATIVE_TOKEN_ADDRESS,
    decimals: 18,
    logoURI: '/token-icons/mon.png'
  },
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
  { symbol: 'BTC', name: 'Bitcoin', address: NATIVE_TOKEN_ADDRESS, decimals: 18, logoURI: '/token-icons/btc.png' },
];

const MERLIN_TOKENS: TokenOption[] = [
  { symbol: 'MERL', name: 'Merlin',      address: '0x5c46bff4b38dc1eae09c5bac65872a1d8bc87378', decimals: 18, logoURI: '/token-icons/merl.png'  },
  { symbol: 'WBTC', name: 'Wrapped BTC', address: '0xf6d226f9dc15d9bb51182815b320d3fbe324e1ba', decimals: 8,  logoURI: '/token-icons/wbtc.png' },
  { symbol: 'BTC',  name: 'Bitcoin',     address: NATIVE_TOKEN_ADDRESS,                        decimals: 18, logoURI: '/token-icons/btc.png'  },
];

const CORE_TOKENS: TokenOption[] = [
  { symbol: 'CORE', name: 'Core', address: NATIVE_TOKEN_ADDRESS, decimals: 18, logoURI: '/token-icons/core.png' },
];

const B2_NETWORK_TOKENS: TokenOption[] = [
  { symbol: 'BTC',  name: 'Bitcoin',     address: NATIVE_TOKEN_ADDRESS,                        decimals: 18, logoURI: '/token-icons/btc.png' },
  { symbol: 'WBTC', name: 'Wrapped BTC', address: '0x4200000000000000000000000000000000000006', decimals: 8,  logoURI: '/token-icons/wbtc.png' },
];

const ROOTSTOCK_TOKENS: TokenOption[] = [
  { symbol: 'RBTC', name: 'Rootstock Bitcoin', address: NATIVE_TOKEN_ADDRESS, decimals: 18, logoURI: '/token-icons/rbtc.png' },
  { symbol: 'WRBTC', name: 'Wrapped RBTC', address: '0x542fda317318ebf1d3deaf76e0b632741a7e677d', decimals: 18, logoURI: '/token-icons/rbtc.png' }
];

const BOB_TOKENS: TokenOption[] = [
  { symbol: 'UNIBTC', name: 'uniBTC',      address: '0x236f8c0a61da474db21b693fb2ea7aab0c803894', decimals: 8,  logoURI: '/token-icons/unibtc.png' },
  { symbol: 'WBTC',   name: 'Wrapped BTC', address: '0x0555e30da8f98308edb960aa94c0db47230d2b9c', decimals: 8,  logoURI: '/token-icons/wbtc.png'   },
];

export const CHAINS: ChainOption[] = [
  {
    key: 'ethereum',
    name: 'Ethereum',
    chainId: 1,
    logoURI: '/chains/ethereum.svg',
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
    key: 'bob',
    name: 'BOB',
    chainId: 60808,
    logoURI: '/chains/bob.png',
    tokens: BOB_TOKENS
  },
  {
    key: 'bsc',
    name: 'BNB Chain',
    chainId: 56,
    logoURI: '/chains/bnb.svg',
    tokens: BSC_TOKENS
  },
  {
    key: 'monad',
    name: 'Monad',
    chainId: 143,
    logoURI: '/chains/monad.png',
    tokens: MONAD_TOKENS
  },
  {
    key: 'polygon',
    name: 'Polygon',
    chainId: 137,
    logoURI: '/chains/polygon.svg',
    tokens: POLYGON_TOKENS
  },
  {
    key: 'bitlayer',
    name: 'Bitlayer',
    chainId: 200901,
    logoURI: '/chains/bitlayer.png',
    tokens: BITLAYER_TOKENS
  },
  {
    key: 'b2-network',
    name: 'B² Network',
    chainId: 223,
    logoURI: '/chains/b2-network.png',
    tokens: B2_NETWORK_TOKENS
  },
  {
    key: 'rootstock',
    name: 'Rootstock',
    chainId: 30,
    logoURI: '/chains/rootstock.png',
    tokens: ROOTSTOCK_TOKENS
  },
  {
    key: 'core',
    name: 'Core',
    chainId: 1116,
    logoURI: '/chains/core.png',
    tokens: CORE_TOKENS
  },
  {
    key: 'merlin',
    name: 'Merlin',
    chainId: 4200,
    logoURI: '/chains/merlin.jpeg',
    tokens: MERLIN_TOKENS
  },
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
