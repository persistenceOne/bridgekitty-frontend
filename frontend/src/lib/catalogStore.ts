import { useSyncExternalStore } from 'react';
import { resolveApiBaseUrl } from './apiBaseUrl';
import type { Chain, Token } from './catalog';

const STORAGE_KEY = 'bk.catalog';
const SNAPSHOT_VERSION = 1;

interface CatalogState {
  chains: Chain[];
  tokensByChainKey: Map<string, Token[]>;
  ready: boolean;
  fetchedAt: number | null;
}

interface PersistedSnapshot {
  v: number;
  chains: Chain[];
  tokensByChainKey: Record<string, Token[]>;
  fetchedAt: number;
}

interface CatalogResponse {
  chains: Chain[];
  tokensByChainKey: Record<string, Token[]>;
  fetchedAt: string;
}

function readPersisted(): CatalogState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { chains: [], tokensByChainKey: new Map(), ready: false, fetchedAt: null };
    const parsed = JSON.parse(raw) as PersistedSnapshot;
    if (parsed.v !== SNAPSHOT_VERSION || !Array.isArray(parsed.chains)) {
      return { chains: [], tokensByChainKey: new Map(), ready: false, fetchedAt: null };
    }
    return {
      chains: parsed.chains,
      tokensByChainKey: new Map(Object.entries(parsed.tokensByChainKey)),
      ready: parsed.chains.length > 0,
      fetchedAt: parsed.fetchedAt,
    };
  } catch {
    return { chains: [], tokensByChainKey: new Map(), ready: false, fetchedAt: null };
  }
}

let state: CatalogState = readPersisted();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

function persist(next: CatalogState) {
  try {
    const tokensByChainKey: Record<string, Token[]> = {};
    for (const [k, v] of next.tokensByChainKey) tokensByChainKey[k] = v;
    const snapshot: PersistedSnapshot = {
      v: SNAPSHOT_VERSION,
      chains: next.chains,
      tokensByChainKey,
      fetchedAt: next.fetchedAt ?? Date.now(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Private mode / storage disabled — keep going with in-memory state.
  }
}

let inflight: Promise<void> | null = null;

export async function loadCatalog(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const base = resolveApiBaseUrl();
      const url = `${base}/catalog`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Catalog fetch failed (${response.status})`);
      const data = (await response.json()) as CatalogResponse;
      const tokensByChainKey = new Map<string, Token[]>();
      for (const [k, v] of Object.entries(data.tokensByChainKey ?? {})) {
        tokensByChainKey.set(k, v);
      }
      const fetchedAt = data.fetchedAt ? new Date(data.fetchedAt).getTime() : Date.now();
      state = {
        chains: data.chains ?? [],
        tokensByChainKey,
        ready: (data.chains ?? []).length > 0,
        fetchedAt,
      };
      persist(state);
      emit();
    } catch (err) {
      // If we have a cached snapshot, keep it. Otherwise stay un-ready and
      // let the UI surface a retry.
      if (!state.ready) emit();
      // eslint-disable-next-line no-console
      console.warn('[catalog] load failed', err);
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

// ── Synchronous getters (for non-React contexts: services, hooks helpers) ──

export function getChains(): Chain[] {
  return state.chains;
}

export function getChainByKey(key: string): Chain | undefined {
  return state.chains.find((c) => c.key === key);
}

export function getChainByChainId(chainId: number): Chain | undefined {
  return state.chains.find((c) => c.chainId === chainId);
}

// Stable reference returned when a chainKey isn't in the catalog. Allocating
// a new `[]` on each call would violate useSyncExternalStore's "snapshot must
// be referentially stable across renders" contract and crash the tree.
const EMPTY_TOKENS: Token[] = Object.freeze([]) as unknown as Token[];

export function getTokensFor(chainKey: string): Token[] {
  return state.tokensByChainKey.get(chainKey) ?? EMPTY_TOKENS;
}

export function getToken(chainKey: string, symbol: string): Token | undefined {
  return getTokensFor(chainKey).find((t) => t.symbol === symbol);
}

export function getDefaultToken(chainKey: string): Token | undefined {
  return getTokensFor(chainKey)[0];
}

export function getDifferentToken(chainKey: string, excludeSymbol: string): string {
  const tokens = getTokensFor(chainKey);
  const other = tokens.find((t) => t.symbol !== excludeSymbol);
  return other?.symbol ?? tokens[0]?.symbol ?? excludeSymbol;
}

export function isCatalogReady(): boolean {
  return state.ready;
}

// ── React hooks (subscribe components to store changes) ──

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useChains(): Chain[] {
  return useSyncExternalStore(subscribe, getChains, getChains);
}

export function useChainByKey(key: string): Chain | undefined {
  return useSyncExternalStore(
    subscribe,
    () => getChainByKey(key),
    () => getChainByKey(key),
  );
}

export function useChainByChainId(chainId: number): Chain | undefined {
  return useSyncExternalStore(
    subscribe,
    () => getChainByChainId(chainId),
    () => getChainByChainId(chainId),
  );
}

export function useTokensFor(chainKey: string): Token[] {
  return useSyncExternalStore(
    subscribe,
    () => getTokensFor(chainKey),
    () => getTokensFor(chainKey),
  );
}

export function useCatalogReady(): boolean {
  return useSyncExternalStore(subscribe, isCatalogReady, isCatalogReady);
}
