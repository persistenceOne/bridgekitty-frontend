import { ShieldCheck } from 'lucide-react';
import { toggleSafeAssetsOnly, useSafeAssetsOnly } from '../lib/safeAssets';

export function SafeAssetsToggle() {
  const on = useSafeAssetsOnly();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className={`hf-safe-toggle ${on ? 'hf-safe-toggle--on' : ''}`}
      onClick={toggleSafeAssetsOnly}
    >
      <span className="hf-safe-toggle-label">
        <ShieldCheck
          size={15}
          className={`hf-safe-toggle-icon ${on ? 'hf-safe-toggle-icon--on' : ''}`}
        />
        <span className="hf-safe-toggle-text">
          <span className="hf-safe-toggle-title">Safe mode</span>
          <span className="hf-safe-toggle-desc">
            {on
              ? 'Showing native tokens, BTC variants (WBTC, BTCB, cbBTC) and stablecoins (USDC, USDT, DAI) only.'
              : 'All supported tokens are visible. Toggle on to restrict to trusted assets only.'}
          </span>
        </span>
      </span>
      <span className={`hf-safe-toggle-track ${on ? 'hf-safe-toggle-track--on' : ''}`}>
        <span className="hf-safe-toggle-thumb" />
      </span>
    </button>
  );
}
