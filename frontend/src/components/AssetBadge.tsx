import {
  getChains,
  getToken,
  useCatalogReady,
  useChainByKey,
  useChainByChainId,
} from '../lib/catalogStore';
import { PROVIDER_META } from '../constants';

/**
 * Inline-image badges for chains, tokens, and providers. Each shows the
 * SVG/PNG logo from the same catalog the swap-page token selector uses, with
 * the human-readable name as a `title` (browser-native tooltip on hover).
 *
 * Fallback when the catalog doesn't know an asset: render the raw key as
 * small muted text so we never blank-render the dashboard.
 */

interface BadgeBaseProps {
  size?: number;
  className?: string;
}

interface ChainBadgeProps extends BadgeBaseProps {
  chainKey?: string;
  chainId?: number;
  /** Render the chain name beside the logo. */
  withLabel?: boolean;
}

export function ChainBadge({ chainKey, chainId, size = 18, className, withLabel }: ChainBadgeProps) {
  // Subscribe to catalog readiness so the badge upgrades from text fallback
  // → logo once the async catalog load resolves.
  useCatalogReady();
  const byKey = useChainByKey(chainKey ?? '');
  const byId = useChainByChainId(chainId ?? -1);
  const chain = chainKey ? byKey : byId;
  const fallbackText = chainKey ?? (chainId != null ? String(chainId) : '?');

  if (!chain) {
    return (
      <span className={`hf-badge-fallback ${className ?? ''}`} title={fallbackText}>
        {fallbackText}
      </span>
    );
  }
  return (
    <span className={`hf-badge-wrap ${className ?? ''}`} title={chain.name}>
      <img
        src={chain.logoURI}
        alt={chain.name}
        className="hf-badge"
        style={{ width: size, height: size }}
      />
      {withLabel && <span className="hf-badge-label">{chain.name}</span>}
    </span>
  );
}

interface TokenBadgeProps extends BadgeBaseProps {
  symbol: string;
  withLabel?: boolean;
}

export function TokenBadge({ symbol, size = 18, className, withLabel }: TokenBadgeProps) {
  useCatalogReady();
  // Search every chain for the first token with this symbol. Same symbol can
  // live on multiple chains (USDC on eth/base/etc); the logo is the same.
  let logoURI: string | undefined;
  let name: string | undefined;
  for (const chain of getChains()) {
    const t = getToken(chain.key, symbol);
    if (t) {
      logoURI = t.logoURI;
      name = t.name;
      break;
    }
  }
  if (!logoURI) {
    return (
      <span className={`hf-badge-fallback ${className ?? ''}`} title={symbol}>
        {symbol}
      </span>
    );
  }
  const tooltip = name ? `${symbol} — ${name}` : symbol;
  return (
    <span className={`hf-badge-wrap ${className ?? ''}`} title={tooltip}>
      <img
        src={logoURI}
        alt={name ?? symbol}
        className="hf-badge"
        style={{ width: size, height: size }}
      />
      {withLabel && <span className="hf-badge-label">{symbol}</span>}
    </span>
  );
}

interface ProviderBadgeProps extends BadgeBaseProps {
  provider: string;
  withLabel?: boolean;
}

export function ProviderBadge({ provider, size = 18, className, withLabel }: ProviderBadgeProps) {
  const meta = PROVIDER_META.find((m) => m.key === provider);
  if (!meta) {
    return (
      <span className={`hf-badge-fallback ${className ?? ''}`} title={provider}>
        {provider}
      </span>
    );
  }
  return (
    <span className={`hf-badge-wrap ${className ?? ''}`} title={meta.label}>
      <img
        src={meta.logo}
        alt={meta.label}
        className="hf-badge"
        style={{ width: size, height: size }}
      />
      {withLabel && <span className="hf-badge-label">{meta.label}</span>}
    </span>
  );
}
