import type { ChainKey } from './lib/chains';
import type { ProviderKey, SwapDraft, TxStage } from './types';
import { resolveApiBaseUrl } from './lib/apiBaseUrl';

export const HAS_PRIVY = Boolean(import.meta.env.VITE_PRIVY_APP_ID);
export const IS_PROD = import.meta.env.PROD;

export const DEFAULT_DRAFT: SwapDraft = {
  fromChain: 'ethereum',
  toChain: 'base',
  fromTokenSymbol: 'WBTC',
  toTokenSymbol: 'cbBTC',
  amount: ''
};

export const DEBOUNCE_MS = 1000;
export const QUOTE_REFRESH_INTERVAL_S = 60;
export const HISTORY_LIMIT = 50;

export const API_BASE_URL = resolveApiBaseUrl();

export const LIVE_PROVIDERS: ProviderKey[] = ['lifi', 'squid', 'debridge', 'relay', 'across', 'symbiosis', 'meson'];

export const PROVIDER_META: { key: ProviderKey; label: string; logo: string }[] = [
  { key: 'lifi',      label: 'LI.FI',     logo: '/providers/lifi.png'      },
  { key: 'squid',     label: 'Squid',     logo: '/providers/squid.ico'     },
  { key: 'debridge',  label: 'deBridge',  logo: '/providers/debridge.png'  },
  { key: 'relay',     label: 'Relay',     logo: '/providers/relay.png'     },
  { key: 'across',    label: 'Across',    logo: '/providers/across.png'    },
  { key: 'symbiosis', label: 'Symbiosis', logo: '/providers/symbiosis.png' },
  { key: 'meson',     label: 'Meson',     logo: '/providers/meson.png'     },
];

export const BLOCK_EXPLORER: Record<ChainKey, string> = {
  ethereum: 'https://etherscan.io/tx/',
  base: 'https://basescan.org/tx/',
  bsc: 'https://bscscan.com/tx/',
  polygon: 'https://polygonscan.com/tx/',
  monad: 'https://monadscan.com/tx/',
  bitlayer: 'https://www.btrscan.com/tx/',
  merlin: 'https://scan.merlinchain.io/tx/',
  core: 'https://scan.coredao.org/tx/',
  'b2-network': 'https://explorer.bsquared.network/tx/',
  rootstock: 'https://rootstock.blockscout.com/tx/',
  bob: 'https://explorer.gobob.xyz/tx/'
};

export const TX_STAGES: { key: TxStage; label: string }[] = [
  { key: 'submitted',  label: 'Submitted' },
  { key: 'confirming', label: 'Confirming' },
  { key: 'bridging',   label: 'Bridging' },
  { key: 'completed',  label: 'Complete' }
];
