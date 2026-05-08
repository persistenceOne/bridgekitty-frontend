import type { Chain, Token } from './catalog';

const NATIVE_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

/**
 * Minimal hardcoded catalog snapshot used only when:
 *   1. There is no cached snapshot in localStorage (first-ever visit), AND
 *   2. The fetch of /api/v1/catalog fails or times out.
 *
 * Mirrors the backend's prisma/seed.ts at the time of cutover so the
 * fallback shows exactly what the backend would have served. Lets users
 * complete basic swaps even if the backend is unreachable. Long-tail
 * search is unavailable in this state — the picker shows curated
 * tokens only.
 *
 * If the backend's seed expands, update this file too. The duplication is
 * deliberate: it's the price of graceful degradation. Reviewer of PR #5
 * specifically requested fallback so the UI never gets stuck on
 * "Loading…".
 */
export const FALLBACK_CATALOG: { chains: Chain[]; tokensByChainKey: Record<string, Token[]> } = {
  chains: [
    { key: 'ethereum',   chainId: 1,      name: 'Ethereum',   logoURI: '/token-icons/eth.svg',   blockExplorerUrl: 'https://etherscan.io/tx/' },
    { key: 'base',       chainId: 8453,   name: 'Base',       logoURI: '/chains/base.svg',       blockExplorerUrl: 'https://basescan.org/tx/' },
    { key: 'bsc',        chainId: 56,     name: 'BNB Chain',  logoURI: '/chains/bnb.svg',        blockExplorerUrl: 'https://bscscan.com/tx/' },
    { key: 'polygon',    chainId: 137,    name: 'Polygon',    logoURI: '/chains/polygon.svg',    blockExplorerUrl: 'https://polygonscan.com/tx/' },
    { key: 'monad',      chainId: 143,    name: 'Monad',      logoURI: '/chains/monad.png',      blockExplorerUrl: 'https://monadscan.com/tx/' },
    { key: 'bitlayer',   chainId: 200901, name: 'Bitlayer',   logoURI: '/chains/bitlayer.svg',   blockExplorerUrl: 'https://www.btrscan.com/tx/' },
    { key: 'merlin',     chainId: 4200,   name: 'Merlin',     logoURI: '/chains/merlin.png',     blockExplorerUrl: 'https://scan.merlinchain.io/tx/' },
    { key: 'core',       chainId: 1116,   name: 'Core',       logoURI: '/chains/core.webp',      blockExplorerUrl: 'https://scan.coredao.org/tx/' },
    { key: 'b2-network', chainId: 223,    name: 'B² Network', logoURI: '/chains/b2-network.png', blockExplorerUrl: 'https://explorer.bsquared.network/tx/' },
    { key: 'rootstock',  chainId: 30,     name: 'Rootstock',  logoURI: '/chains/rootstock.webp', blockExplorerUrl: 'https://rootstock.blockscout.com/tx/' },
    { key: 'bob',        chainId: 60808,  name: 'BOB',        logoURI: '/chains/bob.webp',       blockExplorerUrl: 'https://explorer.gobob.xyz/tx/' },
  ],
  tokensByChainKey: {
    ethereum: [
      { symbol: 'USDC', name: 'USD Coin',        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6,  logoURI: '/token-icons/usdc.svg', tags: ['stablecoin'] },
      { symbol: 'USDT', name: 'Tether USD',      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6,  logoURI: '/token-icons/usdt.svg', tags: ['stablecoin'] },
      { symbol: 'DAI',  name: 'Dai Stablecoin',  address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18, logoURI: '/token-icons/dai.svg',  tags: ['stablecoin'] },
      { symbol: 'WBTC', name: 'Wrapped Bitcoin', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8,  logoURI: '/token-icons/wbtc.png', tags: ['btc-variant'] },
    ],
    base: [
      { symbol: 'USDC',  name: 'USD Coin',             address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6,  logoURI: '/token-icons/usdc.svg',  tags: ['stablecoin'] },
      { symbol: 'USDT',  name: 'Tether USD',           address: '0xfde4C96c8593536e31F229EA8f37b2Ada2699bb2', decimals: 6,  logoURI: '/token-icons/usdt.svg',  tags: ['stablecoin'] },
      { symbol: 'DAI',   name: 'Dai Stablecoin',       address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', decimals: 18, logoURI: '/token-icons/dai.svg',   tags: ['stablecoin'] },
      { symbol: 'cbBTC', name: 'Coinbase Wrapped BTC', address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf', decimals: 8,  logoURI: '/token-icons/cbbtc.png', tags: ['btc-variant'] },
    ],
    bsc: [
      { symbol: 'USDT', name: 'Tether USD',             address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18, logoURI: '/token-icons/usdt.svg', tags: ['stablecoin'] },
      { symbol: 'USDC', name: 'USD Coin',               address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18, logoURI: '/token-icons/usdc.svg', tags: ['stablecoin'] },
      { symbol: 'BTCB', name: 'Binance-Peg BTCB Token', address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', decimals: 18, logoURI: '/token-icons/btcb.png', tags: ['btc-variant'] },
    ],
    polygon: [
      { symbol: 'USDC', name: 'USD Coin',        address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6, logoURI: '/token-icons/usdc.svg', tags: ['stablecoin'] },
      { symbol: 'USDT', name: 'Tether USD',      address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6, logoURI: '/token-icons/usdt.svg', tags: ['stablecoin'] },
      { symbol: 'WBTC', name: 'Wrapped Bitcoin', address: '0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6', decimals: 8, logoURI: '/token-icons/wbtc.png', tags: ['btc-variant'] },
    ],
    monad: [
      { symbol: 'WBTC', name: 'Wrapped Bitcoin', address: '0x0555E30da8f98308EdB960aa94C0Db47230d2B9c', decimals: 8, logoURI: '/token-icons/wbtc.png', tags: ['btc-variant'] },
    ],
    bitlayer: [
      { symbol: 'BTC',  name: 'Bitcoin',    address: NATIVE_TOKEN_ADDRESS,                            decimals: 18, logoURI: '/token-icons/wbtc.png', tags: ['native', 'btc-variant'] },
      { symbol: 'USDC', name: 'USD Coin',   address: '0xf8C374CE88A3BE3d374e8888349C7768B607c755',    decimals: 6,  logoURI: '/token-icons/usdc.svg', tags: ['stablecoin'] },
      { symbol: 'USDT', name: 'Tether USD', address: '0xfe9f969faf8ad72a83b761138bf25de87eff9dd2',    decimals: 6,  logoURI: '/token-icons/usdt.svg', tags: ['stablecoin'] },
    ],
    merlin: [
      { symbol: 'BTC',  name: 'Bitcoin', address: NATIVE_TOKEN_ADDRESS,                         decimals: 18, logoURI: '/token-icons/wbtc.png', tags: ['native', 'btc-variant'] },
      { symbol: 'USDC', name: 'M-USDC',  address: '0xb880fd278198bd590252621d4cd071b1842e9bcd', decimals: 6,  logoURI: '/token-icons/usdc.svg', tags: ['stablecoin'] },
      { symbol: 'USDT', name: 'M-USDT',  address: '0x3a01a5f50c8eaf82f2a72ee3a30f44d2f0e9e7e0', decimals: 6,  logoURI: '/token-icons/usdt.svg', tags: ['stablecoin'] },
    ],
    core: [
      { symbol: 'USDC', name: 'USD Coin',   address: '0xa4151B2B3e269645181dCcF2D426cE75fcbDeca9', decimals: 6, logoURI: '/token-icons/usdc.svg', tags: ['stablecoin'] },
      { symbol: 'USDT', name: 'Tether USD', address: '0x900101d06A7426441Ae63e9AB3B9b0F63Be145F1', decimals: 6, logoURI: '/token-icons/usdt.svg', tags: ['stablecoin'] },
    ],
    'b2-network': [
      { symbol: 'BTC',  name: 'Bitcoin',    address: NATIVE_TOKEN_ADDRESS,                         decimals: 18, logoURI: '/token-icons/wbtc.png', tags: ['native', 'btc-variant'] },
      { symbol: 'USDC', name: 'USD Coin',   address: '0x6c47db95e8d54daedd58e02e1c0e83b25b7e2e0a', decimals: 6,  logoURI: '/token-icons/usdc.svg', tags: ['stablecoin'] },
      { symbol: 'USDT', name: 'Tether USD', address: '0xb1bb86c3eb1d65a5e72f6c3b8d99e0c9bcf4b4f4', decimals: 6,  logoURI: '/token-icons/usdt.svg', tags: ['stablecoin'] },
    ],
    rootstock: [
      { symbol: 'RBTC', name: 'Smart Bitcoin', address: NATIVE_TOKEN_ADDRESS,                         decimals: 18, logoURI: '/chains/rootstock.webp', tags: ['native', 'btc-variant'] },
      { symbol: 'WBTC', name: 'Wrapped BTC',   address: '0x542fda317318ebf1d3deaf76e0b632741a7e677d', decimals: 18, logoURI: '/token-icons/wbtc.png',  tags: ['btc-variant'] },
    ],
    bob: [
      { symbol: 'WBTC', name: 'Wrapped Bitcoin', address: '0x03c7054bcb39f7b2e5b2c7acb37583e32d70cfa3', decimals: 8, logoURI: '/token-icons/wbtc.png', tags: ['btc-variant'] },
      { symbol: 'USDC', name: 'USDC.e',          address: '0xe75d0fb2c24a55ca1e3f96781a2bcc7bdba058f0', decimals: 6, logoURI: '/token-icons/usdc.svg', tags: ['stablecoin'] },
    ],
  },
};
