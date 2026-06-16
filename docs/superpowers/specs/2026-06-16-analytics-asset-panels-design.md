# Analytics dashboard: per-asset & cumulative panels

**Date:** 2026-06-16
**Branch:** feat/analytics-dashboard-polish

## Context

The backend (bridgekitty-backend, branch feat/analytics-extensions-v0.3.7) added new
financial-presentation analytics fields to two endpoints. The frontend dashboards don't
surface them yet. This change wires them into both the public `StatsView` and the admin
`AdminView`, matching existing Recharts + `.hf-*` panel patterns and degrading gracefully
when a period has no data.

### New backend fields
- **`GET /api/v1/stats`** (public): `assetBreakdown {SYM: usd}`, `dailySeries[].volume`,
  `dailySeries[].assets {SYM: usd}`, `cumulativeSeries[].volume`.
- **`GET /api/v1/admin/stats/overview`** (admin, superset): the above plus
  `feeBreakdown {SYM: {feeUsd, integratorFeeUsd}}`, `dailySeries[].cumulativeVolume`,
  `revenueSeries[].cumulativeIntegratorFeeUsd`, `revenueSeries[].cumulativeTotalFeeUsd`.

## Decisions (user-approved)
- Surface in **both** public and admin views.
- Per-day asset volume → **stacked area** chart.
- **Fees by asset** panel is **admin-only**.

## Shared helper — `frontend/src/lib/assetSeries.ts` (new)
Pure, unit-testable:
- `flattenAssetSeries(daily, breakdown, maxAssets=6)` → `{ rows, assets }` where `rows` is
  `Array<{ date, [SYM]: number }>` (one numeric key per top asset, remainder folded into
  `Other`) and `assets` is the ordered symbol list used to render stacked `<Area>`s.
  Top assets chosen by total volume from `breakdown` (falls back to summing `daily`).
- `assetColor(symbol, index)` → stable color from a fixed palette (reuse the orange-family
  tokens already in the charts: `#e59636`, `#c97d1e`, plus a small complementary set).

## Public `StatsView.tsx`
1. Extend `StatsData`/`DailyPoint`/`CumulativePoint` types with `volume?` and `assets?`.
2. **New panel — Volume by asset**: Recharts `PieChart` donut from `assetBreakdown`, legend +
   USD tooltip (`formatUsd`). Guard `Object.keys(assetBreakdown).length > 0`.
3. **New panel — Volume by asset (daily)**: stacked `AreaChart` from `flattenAssetSeries`.
4. **Augment "Cumulative growth"**: add a `volume` line on a right Y-axis.

## Admin `AdminView.tsx`
1. Extend `OverviewData` + normalization (line ~120-141) with the new fields, defaulting
   `assetBreakdown: {}`, `feeBreakdown: {}`, and per-point `assets`/`cumulativeVolume`/
   cumulative fee fields.
2. **New panel — Volume by asset**: donut from `assetBreakdown`.
3. **New panel — Fees by asset (admin-only)**: horizontal `BarChart` from `feeBreakdown`
   (bars for `feeUsd` and `integratorFeeUsd` per token), USD tooltip.
4. **New panel — Volume by asset (daily)**: stacked `AreaChart`.
5. **Augment "Daily swaps & volume"**: add `cumulativeVolume` line (right axis).
6. **Augment "BridgeKitty revenue"**: add `cumulativeIntegratorFeeUsd` + `cumulativeTotalFeeUsd`
   lines onto the existing `AreaChart`.

## Out of scope
- No new routing/auth. Admin stays gated at `#admin`; public stays where `StatsView` mounts.
- No backend changes (already shipped + verified).

## Verification
1. `npx tsc -b` / `npm run build` clean in `frontend/`.
2. Unit test `assetSeries.ts` (top-N fold, Other bucket, empty input).
3. Run backend (`npx tsx --env-file=.env src/index.ts`, prod DB, read-only) + frontend
   (`npm run dev`, :5173, `.env.local` → localhost:3000).
4. kimi-webbridge: open `localhost:5173`, view public stats + `#admin` (enter admin token),
   screenshot the new panels, confirm asset donut / stacked area / cumulative lines render
   with real data and the source filter still works.
