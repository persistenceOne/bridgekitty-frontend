import { describe, expect, it } from 'vitest';
import {
  assetColor,
  toAssetSlices,
  flattenAssetSeries,
  OTHER_LABEL,
  type DailyAssetPoint,
} from '../assetSeries';

describe('toAssetSlices', () => {
  it('ranks descending and drops zero/empty', () => {
    expect(toAssetSlices({ USDC: 100, ETH: 250, ZERO: 0 })).toEqual([
      { name: 'ETH', value: 250 },
      { name: 'USDC', value: 100 },
    ]);
    expect(toAssetSlices(undefined)).toEqual([]);
  });

  it('folds assets past maxAssets into Other', () => {
    const slices = toAssetSlices({ A: 10, B: 9, C: 8, D: 7 }, 2);
    expect(slices).toEqual([
      { name: 'A', value: 10 },
      { name: 'B', value: 9 },
      { name: OTHER_LABEL, value: 15 },
    ]);
  });
});

describe('flattenAssetSeries', () => {
  const daily: DailyAssetPoint[] = [
    { date: '2026-05-01', assets: { USDC: 100, ETH: 50 } },
    { date: '2026-05-02', assets: {} },
    { date: '2026-05-03', assets: { USDC: 200, WBTC: 5 } },
  ];

  it('emits one row per day with a key per top asset', () => {
    const { rows, assets } = flattenAssetSeries(daily, { USDC: 300, ETH: 50, WBTC: 5 });
    expect(assets).toEqual(['USDC', 'ETH', 'WBTC']);
    expect(rows).toEqual([
      { date: '2026-05-01', USDC: 100, ETH: 50, WBTC: 0 },
      { date: '2026-05-02', USDC: 0, ETH: 0, WBTC: 0 },
      { date: '2026-05-03', USDC: 200, ETH: 0, WBTC: 5 },
    ]);
  });

  it('folds non-top assets into Other per day', () => {
    const { rows, assets } = flattenAssetSeries(daily, { USDC: 300, ETH: 50, WBTC: 5 }, 1);
    expect(assets).toEqual(['USDC', OTHER_LABEL]);
    expect(rows[0]).toEqual({ date: '2026-05-01', USDC: 100, [OTHER_LABEL]: 50 });
    expect(rows[2]).toEqual({ date: '2026-05-03', USDC: 200, [OTHER_LABEL]: 5 });
  });

  it('derives totals from daily data when no breakdown given', () => {
    const { assets } = flattenAssetSeries(daily);
    expect(assets).toEqual(['USDC', 'ETH', 'WBTC']); // USDC 300 > ETH 50 > WBTC 5
  });

  it('handles empty input', () => {
    expect(flattenAssetSeries([])).toEqual({ rows: [], assets: [] });
  });
});

describe('assetColor', () => {
  it('is stable and wraps around the palette', () => {
    expect(assetColor(0)).toBe(assetColor(0));
    expect(assetColor(0)).toBe(assetColor(7)); // palette length is 7
    expect(typeof assetColor(3)).toBe('string');
  });
});
