import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  ComposedChart,
  PieChart,
  Pie,
  Cell,
  Sankey,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { API_BASE_URL } from '../constants';
import { BK_SOURCE_HEADER } from '../lib/apiBaseUrl';
import { ChainBadge, TokenBadge, ProviderBadge } from './AssetBadge';
import { getChainByKey, getToken, getChains as _getChains } from '../lib/catalogStore';
import { assetColor, toAssetSlices, flattenAssetSeries } from '../lib/assetSeries';
import { useChartTheme } from '../hooks/useChartTheme';

/**
 * Admin-only analytics. Gated by the ADMIN_TOKEN backend secret — the user
 * pastes it once and we keep it in sessionStorage (cleared on tab close).
 * Reachable only via #admin in the URL; there's no nav link.
 */

const TOKEN_KEY = 'bk_admin_token';
const PAGE_SIZE = 25;

type Period = '7d' | '15d' | '30d' | 'all';

interface PaginationProps {
  offset: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}

function Pagination({ offset, total, onPrev, onNext }: PaginationProps) {
  if (total === 0) return null;
  const start = offset + 1;
  const end = Math.min(offset + PAGE_SIZE, total);
  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_SIZE < total;
  return (
    <div className="hf-admin-pagination">
      <span className="hf-admin-pagination-info">
        {start.toLocaleString()}–{end.toLocaleString()} of {total.toLocaleString()}
      </span>
      <button
        className="hf-admin-pagination-btn"
        disabled={!hasPrev}
        onClick={onPrev}
        aria-label="Previous page"
      >
        ← Prev
      </button>
      <button
        className="hf-admin-pagination-btn"
        disabled={!hasNext}
        onClick={onNext}
        aria-label="Next page"
      >
        Next →
      </button>
    </div>
  );
}

interface DailyPoint { date: string; swaps: number; volume: number; assets?: Record<string, number>; cumulativeVolume?: number }
interface ChainRow { chain: string; swaps: number; volume: number }
interface TokenRow { token: string; swaps: number }
interface ProviderRow { provider: string; swaps: number; volume: number }
interface FlowRow { from: string; to: string; swaps: number; volume: number }
interface DauPoint { date: string; wallets: number }
interface NewWalletPoint { date: string; count: number }
interface RevenuePoint {
  date: string;
  integratorFeeUsd: number;
  totalFeeUsd: number;
  cumulativeIntegratorFeeUsd?: number;
  cumulativeTotalFeeUsd?: number;
}
interface StatusRow { status: string; count: number }
interface SourceRow { source: string; swaps: number; volume: number; users: number }
interface FeeBreakdownEntry { feeUsd: number; integratorFeeUsd: number }

/**
 * Shape we render against, *after* normalization in loadAll. The runtime
 * response from the backend may omit any of these arrays (older BE
 * versions don't include the chainFlow/dauSeries/etc. series). loadAll
 * substitutes `[]` for missing arrays so the rest of the component can
 * treat them as always-present-but-possibly-empty.
 */
interface OverviewData {
  databaseAvailable: boolean;
  period: string;
  windowStart: string;
  uniqueUsers: number;
  swapVolumeUsd: number;
  swapCount: number;
  successRate: number;
  avgDurationMs: number;
  dailySeries: DailyPoint[];
  topChains: ChainRow[];
  topTokens: TokenRow[];
  providerMix: ProviderRow[];
  chainFlow: FlowRow[];
  dauSeries: DauPoint[];
  newWalletsSeries: NewWalletPoint[];
  revenueSeries: RevenuePoint[];
  statusFunnel: StatusRow[];
  sourceBreakdown: SourceRow[];
  assetBreakdown: Record<string, number>;
  feeBreakdown: Record<string, FeeBreakdownEntry>;
}

/** Raw shape as the wire actually returns — every array optional so we
 *  don't crash when the deployed backend predates one of the analytics
 *  extensions. */
interface OverviewResponse extends Partial<OverviewData> {
  databaseAvailable?: boolean;
  period?: string;
  windowStart?: string;
}

function normalizeOverview(o: OverviewResponse): OverviewData {
  return {
    databaseAvailable: o.databaseAvailable ?? false,
    period: o.period ?? '7d',
    windowStart: o.windowStart ?? '',
    uniqueUsers: o.uniqueUsers ?? 0,
    swapVolumeUsd: o.swapVolumeUsd ?? 0,
    swapCount: o.swapCount ?? 0,
    successRate: o.successRate ?? 0,
    avgDurationMs: o.avgDurationMs ?? 0,
    dailySeries: o.dailySeries ?? [],
    topChains: o.topChains ?? [],
    topTokens: o.topTokens ?? [],
    providerMix: o.providerMix ?? [],
    chainFlow: o.chainFlow ?? [],
    dauSeries: o.dauSeries ?? [],
    newWalletsSeries: o.newWalletsSeries ?? [],
    revenueSeries: o.revenueSeries ?? [],
    statusFunnel: o.statusFunnel ?? [],
    sourceBreakdown: o.sourceBreakdown ?? [],
    assetBreakdown: o.assetBreakdown ?? {},
    feeBreakdown: o.feeBreakdown ?? {},
  };
}

interface UserRow {
  address: string;
  firstSeen: string;
  lastSeen: string;
  swapCount: number;
  volume: number;
}

interface TelemetryRow {
  id: string;
  type: string;
  provider: string | null;
  success: boolean | null;
  durationMs: number | null;
  quoteId: string | null;
  fromChainId: number | null;
  toChainId: number | null;
  amount: string | null;
  state: string | null;
  error: string | null;
  createdAt: string;
}

interface ProviderStatRow {
  provider: string;
  executes: number;
  succeeded: number;
  successRate: number;
  avgDurationMs: number;
  lifetimeQuotes: number;
  lifetimeExecutes: number;
}

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function shortAddr(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

interface Props {
  onBack: () => void;
}

const FUNNEL_ORDER = ['submitted', 'confirming', 'confirmed', 'bridging', 'completed', 'failed'];

function orderStatusFunnel(rows: StatusRow[]): StatusRow[] {
  const byStatus = new Map(rows.map((r) => [r.status, r]));
  const ordered: StatusRow[] = [];
  for (const status of FUNNEL_ORDER) {
    const r = byStatus.get(status);
    if (r) {
      ordered.push(r);
      byStatus.delete(status);
    }
  }
  for (const remaining of byStatus.values()) ordered.push(remaining);
  return ordered;
}

/** Canonical channel order + display labels for the source breakdown. */
const SOURCE_ORDER = ['frontend', 'npm', 'virtuals', 'unknown'];
const SOURCE_LABELS: Record<string, string> = {
  frontend: 'Frontend',
  npm: 'npm package',
  virtuals: 'Virtuals (ACP)',
  unknown: 'Unknown',
};

function orderSourceBreakdown(rows: SourceRow[]): (SourceRow & { label: string })[] {
  const rank = (s: string) => {
    const i = SOURCE_ORDER.indexOf(s);
    return i === -1 ? SOURCE_ORDER.length : i;
  };
  return [...rows]
    .sort((a, b) => rank(a.source) - rank(b.source))
    .map((r) => ({ ...r, label: SOURCE_LABELS[r.source] ?? r.source }));
}

interface SankeyData {
  nodes: { name: string }[];
  links: { source: number; target: number; value: number }[];
}

/**
 * Custom Sankey node — render the chain logo (with native tooltip via SVG
 * <title>) outside the rectangle on the appropriate side. Fall back to the
 * chain key if the catalog hasn't resolved this chain yet.
 *
 * The node payload.name is the raw chain key (e.g. "monad"). We resolve to
 * a Chain via getChainByKey so we can render an <image> with the logoURI.
 */
function SankeyNodeWithLabel(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: { name?: string };
  containerWidth?: number;
}) {
  const { x = 0, y = 0, width = 0, height = 0, payload, containerWidth = 0 } = props;
  const chainKey = payload?.name ?? '';
  const chain = getChainByKey(chainKey);
  const displayName = chain?.name ?? chainKey;
  const isSource = x + width / 2 < containerWidth / 2;
  const logoSize = 18;
  const gap = 6;
  // Source nodes: text on left, logo right of text, then rect.
  // Target nodes: rect, then logo, then text on the right.
  const logoX = isSource ? x - logoSize - gap : x + width + gap;
  const logoY = y + height / 2 - logoSize / 2;
  const textX = isSource ? x - logoSize - gap * 2 : x + width + logoSize + gap * 2;
  return (
    <g>
      <title>{displayName}</title>
      <rect x={x} y={y} width={width} height={height} fill="#e59636" fillOpacity={0.9} />
      {chain && (
        <image
          href={chain.logoURI}
          x={logoX}
          y={logoY}
          width={logoSize}
          height={logoSize}
        />
      )}
      <text
        x={textX}
        y={y + height / 2}
        textAnchor={isSource ? 'end' : 'start'}
        dominantBaseline="middle"
        fontSize={11}
        fontWeight={500}
        fill="rgba(29, 19, 6, 0.78)"
        style={{ textTransform: 'capitalize' }}
      >
        {displayName}
      </text>
    </g>
  );
}

/** Custom recharts Y-axis tick: chain logo + name with native SVG title
 *  tooltip. Falls back to raw key when the catalog hasn't resolved. */
function ChainAxisTick(props: { x?: number; y?: number; payload?: { value: string } }) {
  const { x = 0, y = 0, payload } = props;
  const key = payload?.value ?? '';
  const chain = getChainByKey(key);
  const size = 16;
  const labelGap = 4;
  const label = chain?.name ?? key;
  // Anchor everything to the right edge (Y-axis is on the left of a vertical
  // BarChart, so ticks render to the left of x with textAnchor="end").
  return (
    <g transform={`translate(${x - labelGap}, ${y})`}>
      <title>{label}</title>
      <text
        x={-(size + labelGap)}
        y={4}
        textAnchor="end"
        fontSize={10}
        fontWeight={500}
        fill="rgba(29, 19, 6, 0.78)"
        style={{ textTransform: 'capitalize' }}
      >
        {label}
      </text>
      {chain && (
        <image
          href={chain.logoURI}
          x={-size}
          y={-size / 2}
          width={size}
          height={size}
        />
      )}
    </g>
  );
}

/** Custom recharts Y-axis tick: token logo + symbol. Searches every chain
 *  for the symbol since the BE doesn't tell us which chain it came from. */
function TokenAxisTick(props: { x?: number; y?: number; payload?: { value: string } }) {
  const { x = 0, y = 0, payload } = props;
  const symbol = payload?.value ?? '';
  let logoURI: string | undefined;
  let tokenName: string | undefined;
  for (const chain of _getChains()) {
    const found = getToken(chain.key, symbol);
    if (found) {
      logoURI = found.logoURI;
      tokenName = found.name;
      break;
    }
  }
  const size = 16;
  const labelGap = 4;
  return (
    <g transform={`translate(${x - labelGap}, ${y})`}>
      <title>{tokenName ? `${symbol} — ${tokenName}` : symbol}</title>
      <text
        x={-(size + labelGap)}
        y={4}
        textAnchor="end"
        fontSize={10}
        fontWeight={500}
        fill="rgba(29, 19, 6, 0.78)"
      >
        {symbol}
      </text>
      {logoURI && (
        <image
          href={logoURI}
          x={-size}
          y={-size / 2}
          width={size}
          height={size}
        />
      )}
    </g>
  );
}

/**
 * Recharts <Sankey/> takes {nodes, links} where source/target are indices
 * into nodes. We use suffixed node names ("ethereum →" / "→ ethereum") so
 * the same chain can appear as both source and destination without
 * creating cycles. Self-loops (e.g. base→base internal routes) are
 * filtered out — Sankey can't render them coherently.
 */
function buildSankey(flow: FlowRow[]): SankeyData {
  const filtered = flow.filter((f) => f.from !== f.to && f.swaps > 0);
  const sources = Array.from(new Set(filtered.map((f) => f.from)));
  const targets = Array.from(new Set(filtered.map((f) => f.to)));
  // Use the raw chain key as the node name so the custom node component can
  // resolve it via getChainByKey and render the catalog logo.
  const nodes = [
    ...sources.map((s) => ({ name: s })),
    ...targets.map((t) => ({ name: t })),
  ];
  const links = filtered.map((f) => ({
    source: sources.indexOf(f.from),
    target: sources.length + targets.indexOf(f.to),
    value: f.swaps,
  }));
  return { nodes, links };
}


export function AdminView({ onBack }: Props) {
  const [token, setToken] = useState<string>(() => sessionStorage.getItem(TOKEN_KEY) ?? '');
  const [tokenInput, setTokenInput] = useState('');
  const [period, setPeriod] = useState<Period>('7d');
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersOffset, setUsersOffset] = useState(0);
  const [telemetry, setTelemetry] = useState<TelemetryRow[]>([]);
  const [telemetryTotal, setTelemetryTotal] = useState(0);
  const [telemetryOffset, setTelemetryOffset] = useState(0);
  const [providers, setProviders] = useState<ProviderStatRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const chart = useChartTheme();

  const authedFetch = useCallback(
    (path: string) =>
      fetch(`${API_BASE_URL}/admin/stats${path}`, {
        headers: { 'x-admin-token': token, ...BK_SOURCE_HEADER },
      }),
    [token]
  );

  const loadAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setAuthError('');
    try {
      const [oRes, uRes, tRes, pRes] = await Promise.all([
        authedFetch(`/overview?period=${period}`),
        authedFetch(`/users?limit=${PAGE_SIZE}&offset=${usersOffset}`),
        authedFetch(`/telemetry/recent?limit=${PAGE_SIZE}&offset=${telemetryOffset}`),
        authedFetch(`/providers`),
      ]);
      if (oRes.status === 401 || oRes.status === 503) {
        const body = await oRes.json().catch(() => ({}));
        setAuthError(body.error ?? 'Unauthorized');
        sessionStorage.removeItem(TOKEN_KEY);
        setToken('');
        return;
      }
      const [o, u, t, p] = await Promise.all([oRes.json(), uRes.json(), tRes.json(), pRes.json()]);
      // Normalize the overview so any analytics-series the deployed backend
      // doesn't yet emit (chainFlow, dauSeries, etc.) become empty arrays
      // instead of `undefined`. The render path uses `.length > 0` checks
      // and would crash on undefined.
      setOverview(normalizeOverview(o));
      setUsers(u.users ?? []);
      setUsersTotal(u.total ?? 0);
      setTelemetry(t.events ?? []);
      setTelemetryTotal(t.total ?? 0);
      setProviders(p.providers ?? []);
    } catch {
      setAuthError('Network error');
    } finally {
      setLoading(false);
    }
  }, [authedFetch, period, token, usersOffset, telemetryOffset]);

  useEffect(() => {
    if (token) loadAll();
  }, [token, period, usersOffset, telemetryOffset, loadAll]);

  const handleLogin = () => {
    const trimmed = tokenInput.trim();
    if (!trimmed) return;
    sessionStorage.setItem(TOKEN_KEY, trimmed);
    setToken(trimmed);
    setTokenInput('');
  };

  const handleLogout = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken('');
    setOverview(null);
    setUsers([]);
    setUsersTotal(0);
    setUsersOffset(0);
    setTelemetry([]);
    setTelemetryTotal(0);
    setTelemetryOffset(0);
    setProviders([]);
  };

  if (!token) {
    return (
      <motion.main
        key="admin-gate"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2 }}
        className="hf-content hf-stats-wrap"
      >
        <button className="hf-stats-close" onClick={onBack} aria-label="Close">✕</button>
        <div className="hf-stats-header">
          <div className="hf-stats-header-left">
            <p className="hf-kicker">Internal</p>
            <h2 className="hf-stats-title">Admin Dashboard</h2>
            <p className="hf-stats-range">Enter the admin token to continue</p>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            placeholder="ADMIN_TOKEN"
            className="hf-stats-period-btn"
            style={{ padding: '0.6rem 0.8rem', fontSize: '0.85rem' }}
          />
          <button
            className="hf-stats-period-btn active"
            onClick={handleLogin}
            style={{ padding: '0.6rem 0.8rem', fontSize: '0.85rem' }}
          >
            Unlock
          </button>
          {authError && <p className="hf-stats-error">{authError}</p>}
        </div>
      </motion.main>
    );
  }

  return (
    <motion.main
      key="admin"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="hf-content hf-admin-wrap"
    >
      <div className="hf-admin-header">
        <div className="hf-stats-header-left">
          <p className="hf-kicker">Internal</p>
          <h2 className="hf-stats-title">Admin Dashboard</h2>
          <p className="hf-stats-range">
            Period: {period.toUpperCase()} · Window from {overview?.windowStart?.slice(0, 10) ?? '—'}
          </p>
        </div>
        <div className="hf-stats-periods">
          {(['7d', '15d', '30d', 'all'] as Period[]).map((p) => (
            <button
              key={p}
              className={`hf-stats-period-btn ${period === p ? 'active' : ''}`}
              onClick={() => setPeriod(p)}
            >
              {p.toUpperCase()}
            </button>
          ))}
          <button
            className="hf-stats-period-btn"
            onClick={handleLogout}
            title="Clear stored token"
          >
            Logout
          </button>
          <button className="hf-stats-close" onClick={onBack} aria-label="Close">✕</button>
        </div>
      </div>

      {loading && <p className="hf-stats-loading">Loading…</p>}

      {overview && (
        <>
          <div className="hf-admin-cards">
            <div className="hf-stat-card">
              <p className="hf-stat-card-label">Unique Users</p>
              <p className="hf-stat-card-value">{overview.uniqueUsers.toLocaleString()}</p>
            </div>
            <div className="hf-stat-card">
              <p className="hf-stat-card-label">Swap Volume</p>
              <p className="hf-stat-card-value">{formatUsd(overview.swapVolumeUsd)}</p>
              <p className="hf-stat-card-sub">{overview.swapCount.toLocaleString()} swaps</p>
            </div>
            <div className="hf-stat-card">
              <p className="hf-stat-card-label">Success Rate</p>
              <p className="hf-stat-card-value">{(overview.successRate * 100).toFixed(1)}%</p>
              <p className="hf-stat-card-sub">execute telemetry</p>
            </div>
            <div className="hf-stat-card">
              <p className="hf-stat-card-label">Avg Latency</p>
              <p className="hf-stat-card-value">{overview.avgDurationMs.toLocaleString()}ms</p>
              <p className="hf-stat-card-sub">per execute</p>
            </div>
          </div>

          {overview.dailySeries.length > 0 && (
            <div className="hf-admin-panel">
              <p className="hf-admin-panel-title">Daily swaps &amp; volume</p>
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={overview.dailySeries} margin={{ top: 8, right: 24, bottom: 4, left: 0 }}>
                    <CartesianGrid stroke={chart.gridStroke} strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={chart.axisTick}
                      tickFormatter={(d: string) => d.slice(5)}
                      stroke={chart.axisStroke}
                      interval="preserveStartEnd"
                      minTickGap={24}
                    />
                    <YAxis yAxisId="left" tick={chart.axisTick} stroke={chart.axisStroke} allowDecimals={false} />
                    <YAxis yAxisId="right" orientation="right" tick={chart.axisTick} stroke={chart.axisStroke} />
                    <Tooltip contentStyle={chart.tooltip} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                    <Line yAxisId="left" type="monotone" dataKey="swaps" stroke={chart.linePrimary} strokeWidth={2} dot={{ r: 3 }} name="Swaps" />
                    <Line yAxisId="right" type="monotone" dataKey="volume" stroke={chart.lineSecondary} strokeWidth={2} strokeDasharray="4 4" dot={false} name="Volume USD" />
                    <Line yAxisId="right" type="monotone" dataKey="cumulativeVolume" stroke={chart.lineTertiary} strokeWidth={2} dot={false} name="Cumulative volume USD" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {overview.chainFlow.length > 0 && (() => {
            const sankey = buildSankey(overview.chainFlow);
            if (sankey.links.length === 0) return null;
            return (
              <div className="hf-admin-panel">
                <p className="hf-admin-panel-title">Chain-to-chain flow</p>
                <div style={{ width: '100%', height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <Sankey
                      data={sankey}
                      nodePadding={24}
                      nodeWidth={12}
                      margin={{ top: 8, right: 140, bottom: 8, left: 140 }}
                      link={{ stroke: '#e59636', strokeOpacity: 0.35 }}
                      node={<SankeyNodeWithLabel />}
                    >
                      <Tooltip contentStyle={chart.tooltip} />
                    </Sankey>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })()}

          {(overview.dauSeries.length > 0 || overview.newWalletsSeries.length > 0) && (
            <div className="hf-admin-charts-row">
              {overview.dauSeries.length > 0 && (
                <div className="hf-admin-panel">
                  <p className="hf-admin-panel-title">Daily active wallets</p>
                  <div style={{ width: '100%', height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={overview.dauSeries} margin={{ top: 6, right: 16, bottom: 0, left: -8 }}>
                        <CartesianGrid stroke={chart.gridStroke} strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" tick={chart.axisTick} tickFormatter={(d: string) => d.slice(5)} stroke={chart.axisStroke} interval="preserveStartEnd" minTickGap={24} />
                        <YAxis tick={chart.axisTick} stroke={chart.axisStroke} allowDecimals={false} />
                        <Tooltip contentStyle={chart.tooltip} />
                        <Line type="monotone" dataKey="wallets" stroke={chart.linePrimary} strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
              {overview.newWalletsSeries.length > 0 && (
                <div className="hf-admin-panel">
                  <p className="hf-admin-panel-title">New wallets per day</p>
                  <div style={{ width: '100%', height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={overview.newWalletsSeries} margin={{ top: 6, right: 16, bottom: 0, left: -8 }}>
                        <CartesianGrid stroke={chart.gridStroke} strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" tick={chart.axisTick} tickFormatter={(d: string) => d.slice(5)} stroke={chart.axisStroke} interval="preserveStartEnd" minTickGap={24} />
                        <YAxis tick={chart.axisTick} stroke={chart.axisStroke} allowDecimals={false} />
                        <Tooltip contentStyle={chart.tooltip} />
                        <Bar dataKey="count" fill={chart.barFill} radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}

          {overview.revenueSeries.length > 0 && (
            <div className="hf-admin-panel">
              <p className="hf-admin-panel-title">BridgeKitty revenue (integrator fees)</p>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={overview.revenueSeries} margin={{ top: 6, right: 16, bottom: 0, left: -8 }}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#e59636" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="#e59636" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={chart.gridStroke} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={chart.axisTick} tickFormatter={(d: string) => d.slice(5)} stroke={chart.axisStroke} interval="preserveStartEnd" minTickGap={24} />
                    <YAxis yAxisId="left" tick={chart.axisTick} stroke={chart.axisStroke} tickFormatter={(v: number) => `$${v.toFixed(2)}`} />
                    <YAxis yAxisId="right" orientation="right" tick={chart.axisTick} stroke={chart.axisStroke} tickFormatter={(v: number) => `$${v.toFixed(2)}`} />
                    <Tooltip contentStyle={chart.tooltip} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                    <Area yAxisId="left" type="monotone" dataKey="integratorFeeUsd" stroke={chart.linePrimary} strokeWidth={2} fill="url(#revGrad)" name="Integrator fee (revenue)" />
                    <Area yAxisId="left" type="monotone" dataKey="totalFeeUsd" stroke={chart.lineSecondary} strokeWidth={2} strokeDasharray="4 4" fillOpacity={0} name="Total fees (incl. gas/protocol)" />
                    <Line yAxisId="right" type="monotone" dataKey="cumulativeIntegratorFeeUsd" stroke={chart.lineTertiary} strokeWidth={2} dot={false} name="Cumulative revenue" />
                    <Line yAxisId="right" type="monotone" dataKey="cumulativeTotalFeeUsd" stroke={chart.lineQuaternary} strokeWidth={2} strokeDasharray="2 2" dot={false} name="Cumulative total fees" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {(() => {
            const assetSlices = toAssetSlices(overview.assetBreakdown);
            const feeRows = Object.entries(overview.feeBreakdown)
              .map(([token, f]) => ({ token, feeUsd: f.feeUsd, integratorFeeUsd: f.integratorFeeUsd }))
              .filter((r) => r.feeUsd > 0 || r.integratorFeeUsd > 0)
              .sort((a, b) => b.feeUsd - a.feeUsd);
            const { rows: assetDaily, assets: assetKeys } = flattenAssetSeries(
              overview.dailySeries,
              overview.assetBreakdown
            );
            return (
              <>
                {(assetSlices.length > 0 || feeRows.length > 0) && (
                  <div className="hf-admin-charts-row">
                    {assetSlices.length > 0 && (
                      <div className="hf-admin-panel">
                        <p className="hf-admin-panel-title">Volume by asset</p>
                        <div style={{ width: '100%', height: 240 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={assetSlices} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={88} paddingAngle={2}>
                                {assetSlices.map((_, i) => (
                                  <Cell key={i} fill={assetColor(i)} />
                                ))}
                              </Pie>
                              <Tooltip contentStyle={chart.tooltip} formatter={(value, name) => [formatUsd(Number(value)), name]} />
                              <Legend wrapperStyle={{ fontSize: 11 }} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                    {feeRows.length > 0 && (
                      <div className="hf-admin-panel">
                        <p className="hf-admin-panel-title">Fees by asset</p>
                        <div style={{ width: '100%', height: Math.max(160, feeRows.length * 40 + 50) }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={feeRows} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
                              <CartesianGrid stroke={chart.gridStroke} strokeDasharray="3 3" horizontal={false} />
                              <XAxis type="number" tick={chart.axisTick} stroke={chart.axisStroke} tickFormatter={(v: number) => `$${v.toFixed(2)}`} />
                              <YAxis dataKey="token" type="category" tick={chart.axisTick} stroke={chart.axisStroke} width={70} />
                              <Tooltip contentStyle={chart.tooltip} formatter={(value, name) => [formatUsd(Number(value)), name]} />
                              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                              <Bar dataKey="feeUsd" fill={chart.barFill} radius={[0, 4, 4, 0]} name="Total fees" />
                              <Bar dataKey="integratorFeeUsd" fill="#e59636" radius={[0, 4, 4, 0]} name="Integrator (revenue)" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {assetKeys.length > 0 && assetDaily.length > 0 && (
                  <div className="hf-admin-panel">
                    <p className="hf-admin-panel-title">Volume by asset (daily)</p>
                    <div style={{ width: '100%', height: 260 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={assetDaily} margin={{ top: 6, right: 16, bottom: 0, left: -8 }}>
                          <CartesianGrid stroke={chart.gridStroke} strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="date" tick={chart.axisTick} tickFormatter={(d: string) => d.slice(5)} stroke={chart.axisStroke} interval="preserveStartEnd" minTickGap={24} />
                          <YAxis tick={chart.axisTick} stroke={chart.axisStroke} tickFormatter={(v: number) => `$${v.toFixed(2)}`} />
                          <Tooltip contentStyle={chart.tooltip} formatter={(value, name) => [formatUsd(Number(value)), name]} />
                          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                          {assetKeys.map((sym, i) => (
                            <Area key={sym} type="monotone" dataKey={sym} stackId="assets" stroke={assetColor(i)} fill={assetColor(i)} fillOpacity={0.55} name={sym} />
                          ))}
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          {overview.statusFunnel.length > 0 && (
            <div className="hf-admin-panel">
              <p className="hf-admin-panel-title">Status funnel</p>
              <div style={{ width: '100%', height: Math.max(140, orderStatusFunnel(overview.statusFunnel).length * 36 + 40) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={orderStatusFunnel(overview.statusFunnel)} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
                    <CartesianGrid stroke={chart.gridStroke} strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={chart.axisTick} stroke={chart.axisStroke} allowDecimals={false} />
                    <YAxis dataKey="status" type="category" tick={chart.axisTick} stroke={chart.axisStroke} width={90} />
                    <Tooltip contentStyle={chart.tooltip} />
                    <Bar dataKey="count" fill="#e59636" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {overview.sourceBreakdown.length > 0 && (
            <div className="hf-admin-panel">
              <p className="hf-admin-panel-title">Swaps by channel</p>
              <div style={{ width: '100%', height: Math.max(140, orderSourceBreakdown(overview.sourceBreakdown).length * 36 + 40) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={orderSourceBreakdown(overview.sourceBreakdown)} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
                    <CartesianGrid stroke={chart.gridStroke} strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={chart.axisTick} stroke={chart.axisStroke} allowDecimals={false} />
                    <YAxis dataKey="label" type="category" tick={chart.axisTick} stroke={chart.axisStroke} width={90} />
                    <Tooltip
                      contentStyle={chart.tooltip}
                      formatter={(value, _name, item) => {
                        const row = item?.payload as (SourceRow & { label: string }) | undefined;
                        return [`${value} swaps · ${formatUsd(row?.volume ?? 0)} · ${row?.users ?? 0} wallets`, 'Swaps'];
                      }}
                    />
                    <Bar dataKey="swaps" fill="#e59636" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {(overview.topChains.length > 0 || overview.topTokens.length > 0) && (
            <div className="hf-admin-charts-row">
              {overview.topChains.length > 0 && (
                <div className="hf-admin-panel">
                  <p className="hf-admin-panel-title">Top source chains</p>
                  <div style={{ width: '100%', height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={overview.topChains} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
                        <CartesianGrid stroke={chart.gridStroke} strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tick={chart.axisTick} stroke={chart.axisStroke} allowDecimals={false} />
                        <YAxis dataKey="chain" type="category" tick={<ChainAxisTick />} stroke={chart.axisStroke} width={110} />
                        <Tooltip contentStyle={chart.tooltip} />
                        <Bar dataKey="swaps" fill="#e59636" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
              {overview.topTokens.length > 0 && (
                <div className="hf-admin-panel">
                  <p className="hf-admin-panel-title">Top source tokens</p>
                  <div style={{ width: '100%', height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={overview.topTokens} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
                        <CartesianGrid stroke={chart.gridStroke} strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tick={chart.axisTick} stroke={chart.axisStroke} allowDecimals={false} />
                        <YAxis dataKey="token" type="category" tick={<TokenAxisTick />} stroke={chart.axisStroke} width={90} />
                        <Tooltip contentStyle={chart.tooltip} />
                        <Bar dataKey="swaps" fill={chart.barFill} radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}

          {providers.length > 0 && (
            <div className="hf-admin-panel">
              <p className="hf-admin-panel-title">Providers</p>
              <div className="hf-admin-table-scroll">
                <table className="hf-admin-table">
                  <thead>
                    <tr>
                      <th>Provider</th>
                      <th>Executes</th>
                      <th>Success</th>
                      <th>Avg ms</th>
                      <th>Lifetime quotes</th>
                      <th>Lifetime executes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {providers.map((p) => (
                      <tr key={p.provider}>
                        <td><ProviderBadge provider={p.provider} size={22} withLabel /></td>
                        <td>{p.executes.toLocaleString()}</td>
                        <td>{(p.successRate * 100).toFixed(1)}%</td>
                        <td>{p.avgDurationMs.toLocaleString()}</td>
                        <td>{p.lifetimeQuotes.toLocaleString()}</td>
                        <td>{p.lifetimeExecutes.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {usersTotal > 0 && (
            <div className="hf-admin-panel">
              <div className="hf-admin-panel-header">
                <p className="hf-admin-panel-title">Wallets</p>
                <Pagination
                  offset={usersOffset}
                  total={usersTotal}
                  onPrev={() => setUsersOffset((o) => Math.max(0, o - PAGE_SIZE))}
                  onNext={() => setUsersOffset((o) => o + PAGE_SIZE)}
                />
              </div>
              <div className="hf-admin-table-scroll">
                <table className="hf-admin-table">
                  <thead>
                    <tr>
                      <th>Address</th>
                      <th>First seen</th>
                      <th>Last seen</th>
                      <th>Swaps</th>
                      <th>Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.address}>
                        <td className="hf-admin-table-mono" title={u.address}>{shortAddr(u.address)}</td>
                        <td>{u.firstSeen.slice(0, 10)}</td>
                        <td>{u.lastSeen.slice(0, 10)}</td>
                        <td>{u.swapCount.toLocaleString()}</td>
                        <td>{formatUsd(u.volume)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {telemetryTotal > 0 && (
            <div className="hf-admin-panel">
              <div className="hf-admin-panel-header">
                <p className="hf-admin-panel-title">Recent telemetry</p>
                <Pagination
                  offset={telemetryOffset}
                  total={telemetryTotal}
                  onPrev={() => setTelemetryOffset((o) => Math.max(0, o - PAGE_SIZE))}
                  onNext={() => setTelemetryOffset((o) => o + PAGE_SIZE)}
                />
              </div>
              <div className="hf-admin-table-scroll">
                <table className="hf-admin-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Type</th>
                      <th>Provider</th>
                      <th>Success</th>
                      <th>Duration</th>
                      <th>From → To</th>
                      <th>State / Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {telemetry.map((e) => (
                      <tr key={e.id}>
                        <td>{new Date(e.createdAt).toLocaleString()}</td>
                        <td>{e.type}</td>
                        <td>{e.provider ? <ProviderBadge provider={e.provider} size={18} withLabel /> : '—'}</td>
                        <td>{e.success == null ? '—' : e.success ? '✓' : '✕'}</td>
                        <td>{e.durationMs != null ? `${e.durationMs}ms` : '—'}</td>
                        <td>
                          {e.fromChainId != null && e.toChainId != null ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                              <ChainBadge chainId={e.fromChainId} size={16} withLabel />
                              <span style={{ color: 'var(--hf-text-muted)' }}>→</span>
                              <ChainBadge chainId={e.toChainId} size={16} withLabel />
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className={e.error ? 'hf-admin-table-error' : undefined}>
                          {e.error ?? e.state ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </motion.main>
  );
}
