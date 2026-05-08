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
      title={
        on
          ? 'Showing only native tokens, BTC variants (WBTC/BTCB/cbBTC), and stablecoins (USDC/USDT/DAI). Click to show all tokens.'
          : 'Showing all supported tokens. Click to limit to native, BTC variants, and stablecoins only.'
      }
    >
      <ShieldCheck size={11} />
      <span>Safe assets only</span>
      <span className={`hf-safe-toggle-track ${on ? 'hf-safe-toggle-track--on' : ''}`}>
        <span className="hf-safe-toggle-thumb" />
      </span>
    </button>
  );
}
