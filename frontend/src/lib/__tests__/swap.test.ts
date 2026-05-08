import { describe, expect, it } from 'vitest';
import type { TokenOption } from '../chains';
import { matchToken } from '../swap';

const CURATED_USDC: TokenOption = {
  symbol: 'USDC',
  name: 'USD Coin',
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  decimals: 6,
  logoURI: '/token-icons/usdc.svg',
  tags: ['stablecoin'],
};
const LONG_TAIL_USDC_LP: TokenOption = {
  // Same symbol, different address — the exact ambiguity the reviewer asked
  // us to verify resolves to the address-pinned token, not the curated one.
  symbol: 'USDC',
  name: 'OpenEden USDC Vault',
  address: '0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c',
  decimals: 6,
  logoURI: 'https://example.com/openeden.png',
};
const WBTC: TokenOption = {
  symbol: 'WBTC',
  name: 'Wrapped Bitcoin',
  address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
  decimals: 8,
  logoURI: '/token-icons/wbtc.png',
  tags: ['btc-variant'],
};

describe('matchToken', () => {
  const tokens = [CURATED_USDC, LONG_TAIL_USDC_LP, WBTC];

  it('prefers address match when an address is provided', () => {
    // The reviewer's specific concern: user picked the long-tail USDC LP,
    // and the draft pins its address. Symbol-only lookup would return the
    // curated USDC; address-aware lookup must return the LP.
    const got = matchToken(tokens, 'USDC', LONG_TAIL_USDC_LP.address);
    expect(got).toBe(LONG_TAIL_USDC_LP);
    expect(got?.address).toBe(LONG_TAIL_USDC_LP.address);
  });

  it('is case-insensitive on the address compare', () => {
    const got = matchToken(tokens, 'USDC', LONG_TAIL_USDC_LP.address.toLowerCase());
    expect(got).toBe(LONG_TAIL_USDC_LP);
  });

  it('falls back to symbol when address is undefined', () => {
    // Without an address pin, find-by-symbol returns the first match —
    // which is the curated entry (deliberately ranked first in the array).
    const got = matchToken(tokens, 'USDC', undefined);
    expect(got).toBe(CURATED_USDC);
  });

  it('falls back to symbol when address is provided but not in the list', () => {
    const got = matchToken(tokens, 'WBTC', '0xdeadbeef00000000000000000000000000000000');
    expect(got).toBe(WBTC);
  });

  it('returns undefined when neither address nor symbol matches', () => {
    expect(matchToken(tokens, 'NOPE', undefined)).toBeUndefined();
    expect(matchToken(tokens, 'NOPE', '0x0')).toBeUndefined();
  });
});
