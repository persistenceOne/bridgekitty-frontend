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
        authedFetch(`/users?limit=25`),
        authedFetch(`/telemetry/recent?limit=25`),
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxWidth: 420 }}>
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
      className="hf-content hf-stats-wrap"
    >
      <button className="hf-stats-close" onClick={onBack} aria-label="Close">✕</button>

      <div className="hf-stats-header">
        <div className="hf-stats-header-left">
          <p className="hf-kicker">Internal</p>
          <h2 className="hf-stats-title">Admin Dashboard</h2>
          <p className="hf-stats-range">
            Period: {period} · Window from {overview?.windowStart?.slice(0, 10) ?? '—'}
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
        </div>
      </div>

      {loading && <p className="hf-stats-loading">Loading…</p>}

      {overview && (
        <>
          <div className="hf-stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
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
            <div className="hf-stats-section" style={{ marginTop: '1.25rem' }}>
              <p className="hf-stats-section-title">Daily swaps &amp; volume</p>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={overview.dailySeries} margin={{ top: 6, right: 16, bottom: 0, left: -8 }}>
                    <CartesianGrid stroke="rgba(229, 150, 54, 0.12)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d: string) => d.slice(5)} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10 }} allowDecimals={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: '#fff', border: '1px solid rgba(229, 150, 54, 0.3)', borderRadius: 8, fontSize: 12 }} />
                    <Line yAxisId="left" type="monotone" dataKey="swaps" stroke="#e59636" strokeWidth={2} dot={{ r: 3 }} name="Swaps" />
                    <Line yAxisId="right" type="monotone" dataKey="volume" stroke="#c97d1e" strokeWidth={2} strokeDasharray="4 4" dot={false} name="Volume USD" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
            {overview.topChains.length > 0 && (
              <div className="hf-stats-section">
                <p className="hf-stats-section-title">Top source chains</p>
                <div style={{ width: '100%', height: 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={overview.topChains} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 8 }}>
                      <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                      <YAxis dataKey="chain" type="category" tick={{ fontSize: 10 }} width={80} />
                      <Tooltip contentStyle={{ fontSize: 12 }} />
                      <Bar dataKey="swaps" fill="#e59636" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {overview.topTokens.length > 0 && (
              <div className="hf-stats-section">
                <p className="hf-stats-section-title">Top source tokens</p>
                <div style={{ width: '100%', height: 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={overview.topTokens} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 8 }}>
                      <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                      <YAxis dataKey="token" type="category" tick={{ fontSize: 10 }} width={70} />
                      <Tooltip contentStyle={{ fontSize: 12 }} />
                      <Bar dataKey="swaps" fill="#c97d1e" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {providers.length > 0 && (
            <div className="hf-stats-section">
              <p className="hf-stats-section-title">Providers</p>
              <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'rgba(29, 19, 6, 0.55)' }}>
                    <th style={{ padding: '0.4rem 0.5rem' }}>Provider</th>
                    <th style={{ padding: '0.4rem 0.5rem' }}>Executes</th>
                    <th style={{ padding: '0.4rem 0.5rem' }}>Success</th>
                    <th style={{ padding: '0.4rem 0.5rem' }}>Avg ms</th>
                    <th style={{ padding: '0.4rem 0.5rem' }}>Lifetime quotes</th>
                  </tr>
                </thead>
                <tbody>
                  {providers.map((p) => (
                    <tr key={p.provider} style={{ borderTop: '1px solid rgba(229, 150, 54, 0.15)' }}>
                      <td style={{ padding: '0.4rem 0.5rem', fontWeight: 600 }}>{p.provider}</td>
                      <td style={{ padding: '0.4rem 0.5rem' }}>{p.executes.toLocaleString()}</td>
                      <td style={{ padding: '0.4rem 0.5rem' }}>{(p.successRate * 100).toFixed(1)}%</td>
                      <td style={{ padding: '0.4rem 0.5rem' }}>{p.avgDurationMs.toLocaleString()}</td>
                      <td style={{ padding: '0.4rem 0.5rem' }}>{p.lifetimeQuotes.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {users.length > 0 && (
            <div className="hf-stats-section">
              <p className="hf-stats-section-title">Wallets ({users.length})</p>
              <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'rgba(29, 19, 6, 0.55)' }}>
                    <th style={{ padding: '0.4rem 0.5rem' }}>Address</th>
                    <th style={{ padding: '0.4rem 0.5rem' }}>Last seen</th>
                    <th style={{ padding: '0.4rem 0.5rem' }}>Swaps</th>
                    <th style={{ padding: '0.4rem 0.5rem' }}>Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.address} style={{ borderTop: '1px solid rgba(229, 150, 54, 0.15)' }}>
                      <td style={{ padding: '0.4rem 0.5rem', fontFamily: 'var(--hf-mono)' }}>{shortAddr(u.address)}</td>
                      <td style={{ padding: '0.4rem 0.5rem' }}>{u.lastSeen.slice(0, 10)}</td>
                      <td style={{ padding: '0.4rem 0.5rem' }}>{u.swapCount.toLocaleString()}</td>
                      <td style={{ padding: '0.4rem 0.5rem' }}>{formatUsd(u.volume)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {telemetry.length > 0 && (
            <div className="hf-stats-section">
              <p className="hf-stats-section-title">Recent telemetry</p>
              <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'rgba(29, 19, 6, 0.55)' }}>
                    <th style={{ padding: '0.35rem 0.5rem' }}>Time</th>
                    <th style={{ padding: '0.35rem 0.5rem' }}>Type</th>
                    <th style={{ padding: '0.35rem 0.5rem' }}>Provider</th>
                    <th style={{ padding: '0.35rem 0.5rem' }}>Success</th>
                    <th style={{ padding: '0.35rem 0.5rem' }}>Duration</th>
                    <th style={{ padding: '0.35rem 0.5rem' }}>State / Error</th>
                  </tr>
                </thead>
                <tbody>
                  {telemetry.map((e) => (
                    <tr key={e.id} style={{ borderTop: '1px solid rgba(229, 150, 54, 0.15)' }}>
                      <td style={{ padding: '0.35rem 0.5rem' }}>{new Date(e.createdAt).toLocaleString()}</td>
                      <td style={{ padding: '0.35rem 0.5rem' }}>{e.type}</td>
                      <td style={{ padding: '0.35rem 0.5rem' }}>{e.provider ?? '—'}</td>
                      <td style={{ padding: '0.35rem 0.5rem' }}>{e.success == null ? '—' : e.success ? '✓' : '✕'}</td>
                      <td style={{ padding: '0.35rem 0.5rem' }}>{e.durationMs != null ? `${e.durationMs}ms` : '—'}</td>
                      <td style={{ padding: '0.35rem 0.5rem', color: e.error ? '#c62828' : undefined }}>
                        {e.error ?? e.state ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </motion.main>
  );
}
