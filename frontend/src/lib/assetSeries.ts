/**
 * Helpers for the per-asset analytics panels (Volume by asset, stacked daily
 * asset volume). Turns the backend's `{ SYM: usd }` maps into shapes Recharts can
 * render, capping to the top-N assets so stacked charts stay readable.
 *
 * Pure functions — unit-tested in __tests__/assetSeries.test.ts.
 */

/** One day's per-asset volume map, as returned in `dailySeries[].assets`. */
export interface DailyAssetPoint {
  date: string;
  assets?: Record<string, number>;
}

/** Bucket label used when assets beyond the top-N are folded together. */
export const OTHER_LABEL = 'Other';

// Orange-family palette consistent with the existing charts, plus a few
// complementary tones for additional asset series.
const PALETTE = [
  '#e59636',
  '#c97d1e',
  '#f0b860',
  '#8a5a12',
  '#d98a2b',
  '#a36a1f',
  '#6b4410',
];

/** Stable color for the Nth asset series (wraps around the palette). */
export function assetColor(index: number): string {
  return PALETTE[((index % PALETTE.length) + PALETTE.length) % PALETTE.length];
}

/** A donut slice: one asset and its total USD volume, largest first. */
export interface AssetSlice {
  name: string;
  value: number;
}

/**
 * Rank an `assetBreakdown` map into donut slices (descending by value), folding
 * everything past `maxAssets` into a single "Other" slice.
 */
export function toAssetSlices(
  breakdown: Record<string, number> | undefined,
  maxAssets = 6
): AssetSlice[] {
  const entries = Object.entries(breakdown ?? {})
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  if (entries.length <= maxAssets) {
    return entries.map(([name, value]) => ({ name, value }));
  }
  const top = entries.slice(0, maxAssets).map(([name, value]) => ({ name, value }));
  const other = entries.slice(maxAssets).reduce((sum, [, v]) => sum + v, 0);
  return other > 0 ? [...top, { name: OTHER_LABEL, value: other }] : top;
}

export interface FlattenedAssetSeries {
  /** One row per day: `{ date, [SYM]: usd, ... }` with a key per asset in `assets`. */
  rows: Array<Record<string, number | string>>;
  /** Ordered asset keys (top-N by total volume, plus `Other` when folded). */
  assets: string[];
}

/**
 * Flatten `dailySeries[].assets` into stacked-area rows. The top `maxAssets`
 * assets by total volume each get their own key; the remainder are summed into
 * an `Other` key. Asset totals are taken from `breakdown` when provided (so the
 * stack agrees with the donut), otherwise summed from the daily data.
 */
export function flattenAssetSeries(
  daily: DailyAssetPoint[],
  breakdown?: Record<string, number>,
  maxAssets = 6
): FlattenedAssetSeries {
  const totals: Record<string, number> = {};
  if (breakdown && Object.keys(breakdown).length > 0) {
    Object.assign(totals, breakdown);
  } else {
    for (const d of daily) {
      for (const [sym, v] of Object.entries(d.assets ?? {})) {
        totals[sym] = (totals[sym] ?? 0) + v;
      }
    }
  }

  const ranked = Object.entries(totals)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([sym]) => sym);
  const top = ranked.slice(0, maxAssets);
  const topSet = new Set(top);
  const hasOther = ranked.length > top.length;
  const assets = hasOther ? [...top, OTHER_LABEL] : [...top];

  const rows = daily.map((d) => {
    const row: Record<string, number | string> = { date: d.date };
    for (const a of assets) row[a] = 0;
    for (const [sym, v] of Object.entries(d.assets ?? {})) {
      if (topSet.has(sym)) row[sym] = (row[sym] as number) + v;
      else if (hasOther) row[OTHER_LABEL] = (row[OTHER_LABEL] as number) + v;
    }
    return row;
  });

  return { rows, assets };
}
