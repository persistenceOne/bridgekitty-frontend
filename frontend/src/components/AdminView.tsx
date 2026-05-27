import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { API_BASE_URL } from '../constants';

/**
 * Admin-only analytics. Gated by the ADMIN_TOKEN backend secret — the user
 * pastes it once and we keep it in sessionStorage (cleared on tab close).
 * Reachable only via #admin in the URL; there's no nav link.
 */

const TOKEN_KEY = 'bk_admin_token';

type Period = '7d' | '15d' | '30d' | 'all';

interface DailyPoint { date: string; swaps: number; volume: number }
interface ChainRow { chain: string; swaps: number; volume: number }
interface TokenRow { token: string; swaps: number }
interface ProviderRow { provider: string; swaps: number; volume: number }

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

const AXIS_TICK = { fontSize: 10, fill: 'rgba(29, 19, 6, 0.55)' };
const AXIS_STROKE = 'rgba(229, 150, 54, 0.25)';
const GRID_STROKE = 'rgba(229, 150, 54, 0.12)';
const TOOLTIP_STYLE = {
  background: '#fff',
  border: '1px solid rgba(229, 150, 54, 0.3)',
  borderRadius: 8,
  fontSize: 12,
};

export function AdminView({ onBack }: Props) {
  const [token, setToken] = useState<string>(() => sessionStorage.getItem(TOKEN_KEY) ?? '');
  const [tokenInput, setTokenInput] = useState('');
  const [period, setPeriod] = useState<Period>('7d');
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetryRow[]>([]);
  const [providers, setProviders] = useState<ProviderStatRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const authedFetch = useCallback(
    (path: string) =>
      fetch(`${API_BASE_URL}/admin/stats${path}`, {
        headers: { 'x-admin-token': token },
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
        authedFetch(`/users?limit=50`),
        authedFetch(`/telemetry/recent?limit=50`),
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
      setOverview(o);
      setUsers(u.users ?? []);
      setTelemetry(t.events ?? []);
      setProviders(p.providers ?? []);
    } catch {
      setAuthError('Network error');
    } finally {
      setLoading(false);
    }
  }, [authedFetch, period, token]);

  useEffect(() => {
    if (token) loadAll();
  }, [token, period, loadAll]);

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
    setTelemetry([]);
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
                    <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={AXIS_TICK}
                      tickFormatter={(d: string) => d.slice(5)}
                      stroke={AXIS_STROKE}
                      interval={0}
                    />
                    <YAxis yAxisId="left" tick={AXIS_TICK} stroke={AXIS_STROKE} allowDecimals={false} />
                    <YAxis yAxisId="right" orientation="right" tick={AXIS_TICK} stroke={AXIS_STROKE} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                    <Line yAxisId="left" type="monotone" dataKey="swaps" stroke="#e59636" strokeWidth={2} dot={{ r: 3 }} name="Swaps" />
                    <Line yAxisId="right" type="monotone" dataKey="volume" stroke="#c97d1e" strokeWidth={2} strokeDasharray="4 4" dot={false} name="Volume USD" />
                  </LineChart>
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
                        <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tick={AXIS_TICK} stroke={AXIS_STROKE} allowDecimals={false} />
                        <YAxis dataKey="chain" type="category" tick={AXIS_TICK} stroke={AXIS_STROKE} width={90} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
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
                        <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tick={AXIS_TICK} stroke={AXIS_STROKE} allowDecimals={false} />
                        <YAxis dataKey="token" type="category" tick={AXIS_TICK} stroke={AXIS_STROKE} width={80} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Bar dataKey="swaps" fill="#c97d1e" radius={[0, 4, 4, 0]} />
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
                        <td style={{ fontWeight: 600 }}>{p.provider}</td>
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

          {users.length > 0 && (
            <div className="hf-admin-panel">
              <p className="hf-admin-panel-title">Wallets ({users.length})</p>
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

          {telemetry.length > 0 && (
            <div className="hf-admin-panel">
              <p className="hf-admin-panel-title">Recent telemetry</p>
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
                        <td>{e.provider ?? '—'}</td>
                        <td>{e.success == null ? '—' : e.success ? '✓' : '✕'}</td>
                        <td>{e.durationMs != null ? `${e.durationMs}ms` : '—'}</td>
                        <td>
                          {e.fromChainId != null && e.toChainId != null
                            ? `${e.fromChainId} → ${e.toChainId}`
                            : '—'}
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
