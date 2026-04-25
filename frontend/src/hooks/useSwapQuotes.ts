import { useCallback, useEffect, useRef, useState } from 'react';
import { getAllSwapQuotes, QuoteFetchError, type QuoteResult } from '../services/quoteService';
import { isValidSwapInput } from '../lib/swap';
import { DEBOUNCE_MS, LIVE_PROVIDERS, QUOTE_REFRESH_INTERVAL_S } from '../constants';
import type { ProviderKey, SwapDraft } from '../types';

export function useSwapQuotes(activeWalletAddress: string | null) {
  const [quotes, setQuotes] = useState<Partial<Record<ProviderKey, QuoteResult | null>>>({});
  const [isFetching, setIsFetching] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ProviderKey | null>(null);
  const [quoteCountdown, setQuoteCountdown] = useState<number | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const draftRef = useRef<SwapDraft | null>(null);
  const isExecutingRef = useRef(false);

  // Incremented on every fetchQuote call. Async callbacks check this to
  // discard results that belong to a superseded round.
  const roundRef = useRef(0);

  // AbortController for the currently in-flight round. When a new round
  // starts we abort the previous controller so the old fetch is cancelled
  // at the network layer — not just discarded client-side.
  const roundAbortRef = useRef<AbortController | null>(null);

  // Signature of the last draft we fired a fetch for. Used by the amount-change
  // debounce effect to detect "amount was changed programmatically by a path
  // that already called triggerFetchImmediate" and skip the otherwise-duplicate
  // debounced round.
  const lastFetchedAmountRef = useRef<string | null>(null);

  // Backwards-compat shim: SwapView reads `quotingProviders` (Set) and
  // `retryingProviders` (Set) to drive per-row spinners. With the unified
  // single-call model there's no per-provider quoting state — either we're
  // mid-fetch (all providers "loading") or done. We expose a synthetic Set
  // that contains every LIVE_PROVIDERS while `isFetching`, empty otherwise,
  // so existing UI logic continues to work without changes.
  const quotingProviders: Set<ProviderKey> = isFetching
    ? new Set(LIVE_PROVIDERS)
    : new Set();
  const retryingProviders: Set<ProviderKey> = new Set();

  const isQuoting = isFetching;

  const bestQuote = (() => {
    if (selectedProvider && quotes[selectedProvider]) return quotes[selectedProvider]!;
    const available = LIVE_PROVIDERS
      .map((p) => quotes[p])
      .filter((q): q is QuoteResult => q != null);
    if (!available.length) return null;
    return available.reduce((best, q) => (q.feeUsd < best.feeUsd ? q : best));
  })();

  const fetchQuote = useCallback(async (currentDraft: SwapDraft) => {
    if (!isValidSwapInput(currentDraft)) {
      setQuotes({});
      setSelectedProvider(null);
      setIsFetching(false);
      return;
    }

    if (!activeWalletAddress) {
      setQuotes({});
      setSelectedProvider(null);
      setIsFetching(false);
      return;
    }

    // Abort any in-flight fetch from the previous round at the network layer.
    if (roundAbortRef.current) {
      roundAbortRef.current.abort();
    }
    const controller = new AbortController();
    roundAbortRef.current = controller;
    const { signal } = controller;

    const round = ++roundRef.current;
    lastFetchedAmountRef.current = currentDraft.amount;

    setIsFetching(true);
    setQuoteCountdown(null);

    const walletAddr = activeWalletAddress;

    try {
      const { quotes: newQuotes, failed } = await getAllSwapQuotes(
        { ...currentDraft, walletAddress: walletAddr },
        signal
      );

      if (roundRef.current !== round) return;

      // Replace state in one shot — winners get their QuoteResult, losers get
      // null (so SwapView's existing `definitivelyFailed` filter hides them).
      const next: Partial<Record<ProviderKey, QuoteResult | null>> = {};
      for (const p of LIVE_PROVIDERS) {
        const q = newQuotes[p];
        if (q) next[p] = q;
        else if (failed[p]) next[p] = null;
        // If neither map contains it (shouldn't happen) leave undefined.
      }
      setQuotes(next);
      setIsFetching(false);
      setQuoteCountdown(QUOTE_REFRESH_INTERVAL_S);
    } catch (err) {
      if (roundRef.current !== round) return;
      // Aborts mean a newer round took over; do nothing.
      if (err instanceof QuoteFetchError && err.isAbort) return;
      // Any other failure: clear state. The 60s countdown isn't started — the
      // next user action (or wallet event) will trigger a new round.
      setQuotes({});
      setIsFetching(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWalletAddress]);

  const triggerFetchImmediate = useCallback((next: SwapDraft) => {
    setQuotes({});
    setSelectedProvider(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (isValidSwapInput(next)) {
      fetchQuote(next);
    } else {
      // Reset the dedup guard. Otherwise, if a caller clears the amount
      // (e.g. updateFromChain / source-token change), the ref still holds the
      // previously-fetched value — and if the user types that same number again
      // for the new asset, setupAmountDebounce would bail and no quote would fire.
      lastFetchedAmountRef.current = null;
    }
  }, [fetchQuote]);

  const setupAmountDebounce = useCallback((draft: SwapDraft) => {
    draftRef.current = draft;
    if (!isValidSwapInput(draft)) {
      setQuotes({});
      setSelectedProvider(null);
      // Reset the dedup guard so that if the user re-enters the same amount,
      // a quote fires for it. Without this, typing "1.5" → backspace → "1.5"
      // would silently skip the second fetch.
      lastFetchedAmountRef.current = null;
      return;
    }
    // Skip when the amount is identical to the one we just fired a round for.
    // This is how programmatic setters (MAX/50%/Fit gas/swap direction) avoid
    // double-firing: they call triggerFetchImmediate synchronously, then the
    // React state update causes this effect to run — and we bail here because
    // lastFetchedAmountRef was just set by the synchronous fetchQuote call.
    // Normal typing still works: every keystroke produces a *different* amount,
    // so the debounce fires and the ref is updated on completion.
    if (draft.amount === lastFetchedAmountRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchQuote(draft), DEBOUNCE_MS);
  }, [fetchQuote]);

  const clearDebounce = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  // Re-quote when wallet connects so quotes include the wallet address
  useEffect(() => {
    if (activeWalletAddress && draftRef.current && isValidSwapInput(draftRef.current)) {
      fetchQuote(draftRef.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWalletAddress]);

  // Kill countdown whenever all quotes are wiped (back nav, chain change, amount clear)
  useEffect(() => {
    const hasAnyQuote = LIVE_PROVIDERS.some((p) => quotes[p] != null);
    if (!hasAnyQuote) setQuoteCountdown(null);
  }, [quotes]);

  // Single stable interval — does NOT re-create every second.
  // Previously, having `quoteCountdown` in the deps caused the interval to be
  // cleared and re-created on every tick, which led to drift and unexpected resets.
  useEffect(() => {
    const id = setInterval(() => {
      setQuoteCountdown((prev) => {
        if (prev == null || prev <= 0) return prev; // not counting, no-op
        if (prev <= 1) {
          // Time's up — trigger a refresh
          if (draftRef.current && isValidSwapInput(draftRef.current) && !isExecutingRef.current) {
            fetchQuote(draftRef.current);
          }
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  // Only re-create if fetchQuote changes (i.e. wallet address changed)
  }, [fetchQuote]);

  const setIsExecuting = (value: boolean) => {
    isExecutingRef.current = value;
  };

  const clearQuotes = useCallback(() => {
    setQuotes({});
    setSelectedProvider(null);
  }, []);

  return {
    quotes,
    quotingProviders,
    retryingProviders,
    selectedProvider,
    setSelectedProvider,
    quoteCountdown,
    isQuoting,
    bestQuote,
    fetchQuote,
    triggerFetchImmediate,
    setupAmountDebounce,
    clearDebounce,
    setIsExecuting,
    clearQuotes,
    draftRef,
  };
}
