import { beforeEach, describe, expect, it } from 'vitest';
import {
  addExtraToken,
  getToken,
  getTokenByAddress,
  getTokensFor,
} from '../catalogStore';
import { FALLBACK_CATALOG } from '../catalog.fallback';
import type { Token } from '../catalog';

// The store's initial state is read from localStorage at module load. In
// jsdom localStorage is empty, so the store starts un-ready. We seed it via
// addExtraToken — that's enough to exercise the merge/dedup logic the
// reviewer asked us to test, without having to mock a network catalog fetch.

const ETH_USDC: Token = {
  symbol: 'USDC',
  name: 'USD Coin',
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  decimals: 6,
  logoURI: '/token-icons/usdc.svg',
  tags: ['stablecoin'],
};
const ETH_USDC_LP: Token = {
  symbol: 'USDC',
  name: 'OpenEden USDC Vault',
  address: '0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c',
  decimals: 6,
  logoURI: 'https://example.com/openeden.png',
};

describe('addExtraToken', () => {
  beforeEach(() => {
    // Tests share the module-level state. addExtraToken's dedup makes
    // re-adding an idempotent op, so consecutive tests still pass — but we
    // assert lengths relative to the starting state to avoid order issues.
  });

  it('adds a long-tail token to a chain that has no curated entries yet', () => {
    const before = getTokensFor('ethereum').length;
    addExtraToken('ethereum', ETH_USDC_LP);
    const after = getTokensFor('ethereum').length;
    expect(after).toBe(before + 1);
    expect(getTokensFor('ethereum').map((t) => t.address.toLowerCase())).toContain(
      ETH_USDC_LP.address.toLowerCase(),
    );
  });

  it('is idempotent — re-adding the same address is a no-op', () => {
    addExtraToken('ethereum', ETH_USDC_LP);
    const len1 = getTokensFor('ethereum').length;
    addExtraToken('ethereum', ETH_USDC_LP);
    addExtraToken('ethereum', ETH_USDC_LP);
    expect(getTokensFor('ethereum').length).toBe(len1);
  });

  it('dedup is case-insensitive on the address', () => {
    addExtraToken('ethereum', ETH_USDC_LP);
    const len1 = getTokensFor('ethereum').length;
    addExtraToken('ethereum', { ...ETH_USDC_LP, address: ETH_USDC_LP.address.toLowerCase() });
    addExtraToken('ethereum', { ...ETH_USDC_LP, address: ETH_USDC_LP.address.toUpperCase() });
    expect(getTokensFor('ethereum').length).toBe(len1);
  });

  it('symbol collision: extra token coexists with same-symbol curated entry', () => {
    // After adding both, find-by-symbol returns one (curated wins via array
    // order); find-by-address discriminates between them. The reviewer
    // specifically asked us to validate this disambiguation works.
    addExtraToken('ethereum', ETH_USDC);
    addExtraToken('ethereum', ETH_USDC_LP);
    const both = getTokensFor('ethereum').filter((t) => t.symbol === 'USDC');
    expect(both.length).toBeGreaterThanOrEqual(2);

    const byCurated = getTokenByAddress('ethereum', ETH_USDC.address);
    const byLp = getTokenByAddress('ethereum', ETH_USDC_LP.address);
    expect(byCurated?.address).toBe(ETH_USDC.address);
    expect(byLp?.address).toBe(ETH_USDC_LP.address);
    // Symbol-only lookup returns the first; should not collapse to undefined.
    const bySymbol = getToken('ethereum', 'USDC');
    expect(bySymbol).toBeDefined();
  });
});

describe('FALLBACK_CATALOG', () => {
  it('has all curated chains and at least one token per chain', () => {
    expect(FALLBACK_CATALOG.chains.length).toBeGreaterThanOrEqual(11);
    for (const chain of FALLBACK_CATALOG.chains) {
      const tokens = FALLBACK_CATALOG.tokensByChainKey[chain.key] ?? [];
      expect(tokens.length).toBeGreaterThan(0);
    }
  });

  it('every token has an address that parses as something nonempty', () => {
    for (const tokens of Object.values(FALLBACK_CATALOG.tokensByChainKey)) {
      for (const t of tokens) {
        expect(t.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
      }
    }
  });
});
