import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  DemoWalletConnector, PrivyWalletConnector, usePrivyAuth,
  type PrivyWalletBridge
} from './components/WalletConnector';
import { parseUnits } from './lib/amount';
import { makeBalanceKey, matchToken } from './lib/swap';
import { computeUsdValue } from './services/priceService';
import { LandingView } from './components/LandingView';
import { AgentView } from './components/AgentView';
import { SwapView } from './components/SwapView';
import { StatsView } from './components/StatsView';
import { TransactionHistoryModal } from './components/TransactionHistoryModal';
import { loadCatalog, useCatalogReady, useChainByKey, useTokensFor } from './lib/catalogStore';
import { usePrices } from './hooks/usePrices';
import { useTokenBalances } from './hooks/useTokenBalances';
import { useSwapQuotes } from './hooks/useSwapQuotes';
import { useSwapExecution } from './hooks/useSwapExecution';
import { useTransactionHistory } from './hooks/useTransactionHistory';
import { DEFAULT_DRAFT, HAS_PRIVY } from './constants';
import type { EntryView, SwapDraft } from './types';

function App() {
  const [view, setView] = useState<EntryView>('landing');
  const pendingLogin = useRef(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletBridge, setWalletBridge] = useState<PrivyWalletBridge | null>(null);
  const [draft, setDraft] = useState<SwapDraft>(DEFAULT_DRAFT);
  const [historyOpen, setHistoryOpen] = useState(false);

  const privyAuth = usePrivyAuth();
  const activeWalletAddress = walletBridge?.address ?? walletAddress;
  const catalogReady = useCatalogReady();
  const fromChain = useChainByKey(draft.fromChain);
  const fromChainTokens = useTokensFor(draft.fromChain);
  // Placeholder shape used only during the brief window before the catalog
  // resolves on a fresh first visit (no cached snapshot). The render gate
  // below prevents this from reaching the swap form.
  const selectedFromToken =
    matchToken(fromChainTokens, draft.fromTokenSymbol, draft.fromTokenAddress)
    ?? fromChainTokens[0]
    ?? { symbol: '', name: '', address: '', decimals: 18, logoURI: '' };
  const fromChainId = fromChain?.chainId ?? 0;

  // Bootstrap the chain/token catalog from the backend on mount. The store
  // hydrates from localStorage synchronously, so when a cached snapshot
  // exists `catalogReady` is true on first render and the swap form is
  // visible immediately. First-ever visits show the loader below.
  useEffect(() => { void loadCatalog(); }, []);

  // ── Hooks ──
  const prices = usePrices(draft.fromTokenSymbol, draft.toTokenSymbol);

  const {
    tokenBalances, isRefreshingBalances, balanceError,
    formattedSourceBalances, refreshBalancesNow, scheduleBalanceRefresh,
  } = useTokenBalances(activeWalletAddress, draft.fromChain, selectedFromToken);

  const {
    quotes, quotingProviders, retryingProviders, selectedProvider, setSelectedProvider,
    quoteCountdown, isQuoting, bestQuote,
    fetchQuote, triggerFetchImmediate, setupAmountDebounce, clearDebounce,
    setIsExecuting: setQuoteIsExecuting, clearQuotes, draftRef,
  } = useSwapQuotes(activeWalletAddress);

  const onPostSwap = useCallback(() => {
    setDraft((c) => ({ ...c, amount: '' }));
    clearQuotes();
    scheduleBalanceRefresh();
  }, [clearQuotes, scheduleBalanceRefresh]);

  const {
    isExecuting, txStatus, error,
    executeSwap: doExecuteSwap, clearTxStatus, clearError,
  } = useSwapExecution(walletBridge, fromChainId, onPostSwap);

  // Keep quote hook aware of execution state (prevents auto-refresh during swap)
  useEffect(() => {
    setQuoteIsExecuting(isExecuting);
  }, [isExecuting, setQuoteIsExecuting]);

  // Immediately refresh balances when a swap reaches a terminal state.
  // The 'completed' signal means the source-chain tx is confirmed, so the
  // deducted amount is already settled. 'failed' also refreshes in case gas
  // was consumed by a reverted on-chain tx.
  useEffect(() => {
    if (txStatus?.stage === 'completed' || txStatus?.stage === 'failed') {
      refreshBalancesNow();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txStatus?.stage]);

  // Keep draftRef in sync for countdown auto-refresh
  useEffect(() => {
    draftRef.current = draft;
  }, [draft, draftRef]);

  const { historyRecords, historyLoading, historyError } =
    useTransactionHistory(historyOpen, activeWalletAddress, txStatus?.hash);

  // ── Amount debounce ──
  useEffect(() => {
    setupAmountDebounce(draft);
    return () => clearDebounce();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.amount]);

  // ── Gate navigation: require Privy login before entering Human view ──
  const handleHumanClick = () => {
    if (HAS_PRIVY && !privyAuth.authenticated) {
      pendingLogin.current = true;
      privyAuth.login();
      return;
    }
    setView('human');
  };

  useEffect(() => {
    if (HAS_PRIVY && privyAuth.authenticated && pendingLogin.current) {
      pendingLogin.current = false;
      setView('human');
    }
  }, [privyAuth.authenticated]);

  // ── Scroll to top on view change ──
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [view]);

  // ── Swap execution wrapper ──
  const handleExecuteSwap = useCallback(() => {
    if (!bestQuote) return;
    const requestedAmountRaw = (() => {
      const amount = draft.amount.trim();
      if (!amount) return null;
      try {
        return parseUnits(amount, selectedFromToken.decimals);
      } catch {
        return null;
      }
    })();
    const selectedSourceBalanceRaw = tokenBalances[makeBalanceKey(draft.fromChain, selectedFromToken.address)];
    const isAmountInsufficient =
      Boolean(activeWalletAddress)
      && requestedAmountRaw != null
      && selectedSourceBalanceRaw != null
      && requestedAmountRaw > selectedSourceBalanceRaw;

    const volumeUsd = computeUsdValue(prices, draft.fromTokenSymbol, draft.amount)?.value;

    doExecuteSwap(
      draft, bestQuote, selectedFromToken,
      requestedAmountRaw,
      () => privyAuth.login(),
      HAS_PRIVY, privyAuth.authenticated,
      isAmountInsufficient,
      volumeUsd
    );
  }, [draft, bestQuote, selectedFromToken, tokenBalances, activeWalletAddress, prices, doExecuteSwap, privyAuth]);

  const handleBack = useCallback(() => {
    setView('landing');
    setDraft(DEFAULT_DRAFT);
    clearQuotes();
    clearTxStatus();
    clearError();
  }, [clearQuotes, clearTxStatus, clearError]);

  return (
    <div className="hf-app">
      {/* Header */}
      <header className="hf-header">
        <div className="hf-logo" onClick={handleBack} style={{ cursor: 'pointer' }}>
          <img src="/bridgekitty.png" alt="BridgeKitty" className="hf-logo-icon" />
          <div className="hf-logo-brand">
            <span className="hf-logo-text">BridgeKitty</span>
            <span className="hf-logo-by">
              by
              <img
                src="/persistence.png"
                alt="Persistence"
                className="hf-persistence-wordmark"
              />
            </span>
          </div>
        </div>
        {HAS_PRIVY ? (
          <PrivyWalletConnector onWalletAddress={setWalletAddress} onWalletBridge={setWalletBridge} />
        ) : (
          <DemoWalletConnector />
        )}
      </header>

      {/* Main Content */}
      <AnimatePresence mode="wait">
        {view === 'landing' && (
          <LandingView
            onHumanClick={handleHumanClick}
            onAgentClick={() => setView('agent')}
          />
        )}

        {view === 'agent' && (
          <AgentView onBack={() => setView('landing')} />
        )}

        {view === 'stats' && (
          <StatsView onBack={() => setView('landing')} />
        )}

        {view === 'human' && !catalogReady && (
          <motion.main
            key="human-loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="hf-content"
          >
            <p className="hf-history-empty">Loading supported chains and tokens…</p>
          </motion.main>
        )}

        {view === 'human' && catalogReady && (
          <motion.main
            key="human"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.24 }}
            className="hf-content"
          >
            <AnimatePresence mode="wait">
              <SwapView
                draft={draft}
                setDraft={setDraft}
                quotes={quotes}
                quotingProviders={quotingProviders}
                retryingProviders={retryingProviders}
                selectedProvider={selectedProvider}
                setSelectedProvider={setSelectedProvider}
                quoteCountdown={quoteCountdown}
                isQuoting={isQuoting}
                bestQuote={bestQuote}
                fetchQuote={fetchQuote}
                triggerFetchImmediate={triggerFetchImmediate}
                prices={prices}
                tokenBalances={tokenBalances}
                formattedSourceBalances={formattedSourceBalances}
                balanceError={balanceError}
                isRefreshingBalances={isRefreshingBalances}
                walletBridge={walletBridge}
                activeWalletAddress={activeWalletAddress}
                isExecuting={isExecuting}
                txStatus={txStatus}
                error={error}
                executeSwap={handleExecuteSwap}
                onBack={handleBack}
                onToggleHistory={() => setHistoryOpen((prev) => !prev)}
                onTxStatusClear={clearTxStatus}
              />
            </AnimatePresence>
          </motion.main>
        )}
      </AnimatePresence>

      {/* Transaction History Modal */}
      {historyOpen && (
        <TransactionHistoryModal
          activeWalletAddress={activeWalletAddress}
          historyRecords={historyRecords}
          historyLoading={historyLoading}
          historyError={historyError}
          onClose={() => setHistoryOpen(false)}
        />
      )}


      {/* Footer */}
      <footer className="hf-footer">
        <div>
          <button className="hf-footer-link" onClick={() => setView('stats')}>All-Stats</button>
          <a href="https://t.me/PersistenceOneChat" target="_blank" rel="noopener noreferrer">Help</a>
          <a href="https://persistence.one/privacy?lang=en" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
        </div>
        <p>© 2026 Persistence Labs. All Rights Reserved.</p>
      </footer>
    </div>
  );
}

export default App;
