import type { ReactNode } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import {
  mainnet,
  base,
  bob,
  bsc,
  monad,
  polygon,
  bitlayer,
  bsquared,
  rootstock,
  coreDao,
  merlin,
} from 'viem/chains';

// Order mirrors prisma/data/catalog.ts in the backend repo so the chains
// Privy knows about line up 1:1 with what /api/v1/catalog advertises.
// Without this list, viem falls back to its default registry, which
// covers Ethereum/Base/BSC/Polygon but not the BTC-L2s or Monad — and
// switchChain to any unlisted chainId throws "Unsupported chainId 4901"
// at signing time, breaking bridges out of those chains.
const SUPPORTED_CHAINS = [
  mainnet,
  base,
  bob,
  bsc,
  monad,
  polygon,
  bitlayer,
  bsquared,
  rootstock,
  coreDao,
  merlin,
] as const;

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID;

export function AppProviders({ children }: { children: ReactNode }) {
  if (!PRIVY_APP_ID) {
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ['wallet'],
        appearance: {
          theme: 'light',
          accentColor: '#ffafd3'
        },
        defaultChain: mainnet,
        supportedChains: [...SUPPORTED_CHAINS]
      }}
    >
      {children}
    </PrivyProvider>
  );
}
