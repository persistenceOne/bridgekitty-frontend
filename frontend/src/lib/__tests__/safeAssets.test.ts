import { describe, expect, it } from 'vitest';
import type { TokenOption } from '../chains';
import { filterSafe, isSafeToken } from '../safeAssets';

const SAFE: TokenOption[] = [
  { symbol: 'USDC', name: 'USD Coin',        address: '0xA0b86991', decimals: 6,  logoURI: '', tags: ['stablecoin'] },
  { symbol: 'WBTC', name: 'Wrapped Bitcoin', address: '0x2260FAC5', decimals: 8,  logoURI: '', tags: ['btc-variant'] },
  { symbol: 'ETH',  name: 'Ether',           address: '0xeeeeEEee', decimals: 18, logoURI: '', tags: ['native'] },
];
const UNTAGGED: TokenOption = {
  symbol: 'UNI', name: 'Uniswap', address: '0x1f9840a8', decimals: 18, logoURI: '',
  // No tags — power-user / long-tail token.
};

describe('isSafeToken', () => {
  it('returns true for any token tagged native | btc-variant | stablecoin', () => {
    for (const t of SAFE) expect(isSafeToken(t)).toBe(true);
  });
  it('returns false for tokens with no tags', () => {
    expect(isSafeToken(UNTAGGED)).toBe(false);
  });
  it('returns false for tokens tagged with something else', () => {
    const oddly = { ...UNTAGGED, tags: ['governance'] as never };
    expect(isSafeToken(oddly)).toBe(false);
  });
});

describe('filterSafe', () => {
  it('returns the input unchanged when toggle is OFF', () => {
    const input = [...SAFE, UNTAGGED];
    expect(filterSafe(input, false)).toBe(input);
  });
  it('drops untagged tokens when toggle is ON', () => {
    const input = [...SAFE, UNTAGGED];
    const out = filterSafe(input, true);
    expect(out).toHaveLength(SAFE.length);
    expect(out).not.toContain(UNTAGGED);
  });
});
