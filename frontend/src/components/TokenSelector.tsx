import { useEffect, useState } from 'react';
import { ChevronDown, Loader2, X } from 'lucide-react';
import type { TokenOption, ChainOption } from '../lib/chains';
import { filterSafe, useSafeAssetsOnly } from '../lib/safeAssets';
import { searchTokensApi, type SearchToken } from '../services/tokenSearchService';

interface TokenSelectorProps {
  label: string;
  selectedToken: TokenOption;
  tokens: TokenOption[];
  chain: ChainOption;
  chains: ChainOption[];
  /** Called with the full Token object so the caller can register long-tail
   *  selections in the catalog store and pin both symbol + address on the
   *  draft (necessary when search returns multiple tokens with the same
   *  symbol but different addresses). */
  onSelectToken: (token: TokenOption) => void;
  onSelectChain: (chainKey: string) => void;
  /** Controlled: whether the chain modal is open (managed by parent) */
  chainModalOpen: boolean;
  /** Called when the chain modal should close */
  onChainModalClose: () => void;
  /** Map of lowercase token address → formatted balance string */
  balances?: Record<string, string>;
}

const SEARCH_MIN_CHARS = 2;
const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_LIMIT = 25;

export function TokenSelector({
  label,
  selectedToken,
  tokens,
  chain,
  chains,
  onSelectToken,
  onSelectChain,
  chainModalOpen,
  onChainModalClose,
  balances
}: TokenSelectorProps) {
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenSearch, setTokenSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SearchToken[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const safeAssetsOnly = useSafeAssetsOnly();
  const normalizedSearch = tokenSearch.trim();
  const lowerSearch = normalizedSearch.toLowerCase();

  // Server-side search: only fires when safe mode is OFF and the query has at
  // least SEARCH_MIN_CHARS. In safe mode the curated set is small enough that
  // client-side filtering is fine. Below the threshold we don't want to spam
  // the backend on single-character keystrokes.
  const shouldHitServer = !safeAssetsOnly && normalizedSearch.length >= SEARCH_MIN_CHARS;

  useEffect(() => {
    if (!shouldHitServer) {
      setSearchResults(null);
      setSearchError(null);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const result = await searchTokensApi(chain.chainId, normalizedSearch, SEARCH_LIMIT, controller.signal);
        setSearchResults(result.tokens);
      } catch (err) {
        if ((err as DOMException).name === 'AbortError') return;
        setSearchError('Search failed. Try again.');
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [shouldHitServer, normalizedSearch, chain.chainId]);

  // Build the rendered list. Server results take precedence when present;
  // otherwise we fall back to local filtering on the curated tokens passed in.
  let renderedTokens: TokenOption[] = [];
  let emptyMessage: string | null = null;

  if (searchResults !== null) {
    renderedTokens = searchResults;
    if (renderedTokens.length === 0 && !searchError && !searching) {
      emptyMessage = 'No tokens match that search.';
    }
  } else {
    const candidateTokens = filterSafe(tokens, safeAssetsOnly);
    renderedTokens = lowerSearch
      ? candidateTokens.filter((token) =>
          token.symbol.toLowerCase().includes(lowerSearch)
          || token.name.toLowerCase().includes(lowerSearch),
        )
      : candidateTokens;
    if (renderedTokens.length === 0) {
      const hiddenBySafeFilter = safeAssetsOnly && !lowerSearch && tokens.length > 0;
      emptyMessage = hiddenBySafeFilter
        ? 'No safe assets on this chain. Turn off "Safe assets only" to see all tokens.'
        : 'No token matches that search.';
    }
  }

  const closeTokenModal = () => {
    setShowTokenModal(false);
    setTokenSearch('');
    setSearchResults(null);
    setSearchError(null);
  };

  const selectedAddrLower = selectedToken.address.toLowerCase();

  return (
    <>
      <div className="hf-token-selector">
        <button
          className="hf-token-btn"
          onClick={() => setShowTokenModal(true)}
          aria-label={`Select ${label} token`}
        >
          <img
            src={selectedToken.logoURI}
            alt={selectedToken.symbol}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          {selectedToken.symbol}
          <ChevronDown size={12} />
        </button>
      </div>

      {/* Token Selection Modal */}
      {showTokenModal && (
        <div className="hf-dropdown-overlay" onClick={closeTokenModal}>
          <div
            className="hf-dropdown-panel hf-fadeup"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="hf-dropdown-header">
              <h3>Select Token</h3>
              <button
                className="hf-dropdown-close"
                onClick={closeTokenModal}
              >
                <X size={18} />
              </button>
            </div>
            <div className="hf-dropdown-search-wrap">
              <input
                className="hf-dropdown-search"
                placeholder={safeAssetsOnly ? 'Search safe assets' : 'Search by symbol, name, or address'}
                value={tokenSearch}
                onChange={(e) => setTokenSearch(e.target.value)}
              />
              {searching && (
                <Loader2 size={12} className="hf-spin hf-dropdown-search-spinner" aria-label="Searching" />
              )}
            </div>
            <div className="hf-dropdown-list">
              {renderedTokens.map((token) => {
                const addrLower = token.address.toLowerCase();
                const isSelected = addrLower === selectedAddrLower;
                const isLongTail = (token as SearchToken).isFeatured === false;
                return (
                  <button
                    key={addrLower}
                    className={`hf-dropdown-item ${isSelected ? 'hf-dropdown-item-active' : ''}`}
                    onClick={() => {
                      onSelectToken(token);
                      closeTokenModal();
                    }}
                  >
                    <img
                      src={token.logoURI}
                      alt={token.symbol}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <div className="hf-dropdown-item-info">
                      <strong>{token.symbol}</strong>
                      <span>{token.name}</span>
                    </div>
                    {isLongTail && (
                      <span className="hf-dropdown-item-tag" title="Surfaced from provider catalogs — not in BridgeKitty's curated set">
                        long-tail
                      </span>
                    )}
                    {balances?.[addrLower] != null && (
                      <span className="hf-dropdown-item-balance">
                        {balances[addrLower]}
                      </span>
                    )}
                  </button>
                );
              })}
              {searchError && (
                <div className="hf-dropdown-empty">{searchError}</div>
              )}
              {!searching && emptyMessage && renderedTokens.length === 0 && !searchError && (
                <div className="hf-dropdown-empty">{emptyMessage}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Chain Selection Modal */}
      {chainModalOpen && (
        <div className="hf-dropdown-overlay" onClick={onChainModalClose}>
          <div
            className="hf-dropdown-panel hf-fadeup"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="hf-dropdown-header">
              <h3>Select Network</h3>
              <button
                className="hf-dropdown-close"
                onClick={onChainModalClose}
              >
                <X size={18} />
              </button>
            </div>
            <div className="hf-dropdown-list">
              {chains.map((c) => (
                <button
                  key={c.key}
                  className={`hf-dropdown-item ${
                    c.key === chain.key ? 'hf-dropdown-item-active' : ''
                  }`}
                  onClick={() => {
                    onSelectChain(c.key);
                    onChainModalClose();
                  }}
                >
                  <img
                    src={c.logoURI}
                    alt={c.name}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <div className="hf-dropdown-item-info">
                    <strong>{c.name}</strong>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
