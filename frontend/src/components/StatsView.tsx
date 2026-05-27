import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { API_BASE_URL } from '../constants';

type Period = '7d' | '15d' | '30d';

interface DailyPoint {
  date: string;
  swaps: number;
}

interface StatsData {
  period: string;
  uniqueUsers: number;
  swapVolumeUsd: number;
  swapCount: number;
  dailySeries?: DailyPoint[];
}

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

const PERIOD_LABELS: Record<Period, string> = {
  '7d': 'Last 7 days',
  '15d': 'Last 15 days',
  '30d': 'Last 30 days',
};

interface Props {
  onBack: () => void;
}

export function StatsView({ onBack }: Props) {
  const [period, setPeriod] = useState<Period>('7d');
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    fetch(`${API_BASE_URL}/stats?period=${period}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError('Failed to load stats.'); setLoading(false); });
  }, [period]);

  const series = data?.dailySeries ?? [];

  return (
    <motion.main
      key="stats"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="hf-content hf-stats-wrap hf-stats-wrap--wide"
    >
      <button className="hf-stats-close" onClick={onBack} aria-label="Close">✕</button>

      <div className="hf-stats-header">
        <div className="hf-stats-header-left">
          <p className="hf-kicker">Public Dashboard</p>
          <h2 className="hf-stats-title">Product Stats</h2>
          <p className="hf-stats-range">{PERIOD_LABELS[period]}</p>
        </div>
        <div className="hf-stats-periods">
          {(['7d', '15d', '30d'] as Period[]).map((p) => (
            <button
              key={p}
              className={`hf-stats-period-btn ${period === p ? 'active' : ''}`}
              onClick={() => setPeriod(p)}
            >
              {p === '7d' ? '7D' : p === '15d' ? '15D' : '30D'}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="hf-stats-loading">Loading...</p>}
      {error && <p className="hf-stats-error">{error}</p>}

      {data && !loading && (
        <>
          <div className="hf-stats-grid">
            <div className="hf-stat-card">
              <p className="hf-stat-card-label">Unique Users</p>
              <p className="hf-stat-card-value">{data.uniqueUsers.toLocaleString()}</p>
            </div>
            <div className="hf-stat-card">
              <p className="hf-stat-card-label">Swap Volume</p>
              <p className="hf-stat-card-value">{formatUsd(data.swapVolumeUsd)}</p>
              <p className="hf-stat-card-sub">{data.swapCount.toLocaleString()} swaps</p>
            </div>
          </div>

          {series.length > 0 && (
            <div className="hf-stats-section" style={{ marginTop: '1.25rem' }}>
              <p className="hf-stats-section-title">Daily Swaps</p>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series} margin={{ top: 6, right: 8, bottom: 0, left: -16 }}>
                    <CartesianGrid stroke="rgba(229, 150, 54, 0.12)" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: 'rgba(29, 19, 6, 0.55)' }}
                      tickFormatter={(d: string) => d.slice(5)}
                      stroke="rgba(229, 150, 54, 0.25)"
                      interval={0}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'rgba(29, 19, 6, 0.55)' }}
                      stroke="rgba(229, 150, 54, 0.25)"
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#fff',
                        border: '1px solid rgba(229, 150, 54, 0.3)',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      labelStyle={{ fontWeight: 600 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="swaps"
                      stroke="#e59636"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#e59636' }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}

      <p className="hf-stats-note">
        Data reflects activity recorded through BridgeKitty. Swap volume is sourced from executed transactions.
      </p>
    </motion.main>
  );
}
