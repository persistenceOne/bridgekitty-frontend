import { useSyncExternalStore } from 'react';
import { resolveApiBaseUrl } from './apiBaseUrl';
import type { Chain, Token } from './catalog';

const STORAGE_KEY = 'bk.catalog';
const SNAPSHOT_VERSION = 1;

interface CatalogState {
  chains: Chain[];
  /** Curated tokens served by /api/v1/catalog. */
  tokensByChainKey: Map<string, Token[]>;
  /** Session-only long-tail tokens picked from /api/v1/tokens/search results.
   *  Not persisted — they get rediscovered on the next search. */
  extraTokensByChainKey: Map<string, Token[]>;
  /** Pre-merged (curated + extras, deduped by lower(address)) — read by hooks
   *  and synchronous getters. Rebuilt every time tokens or extras change. */
  mergedByChainKey: Map<string, Token[]>;
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

function emptyState(): CatalogState {
  return {
    chains: [],
    tokensByChainKey: new Map(),
    extraTokensByChainKey: new Map(),
    mergedByChainKey: new Map(),
    ready: false,
    fetchedAt: null,
  };
}

function rebuildMerged(
  curated: Map<string, Token[]>,
  extras: Map<string, Token[]>,
): Map<string, Token[]> {
  const out = new Map<string, Token[]>();
  for (const [chainKey, list] of curated) {
    out.set(chainKey, [...list]);
  }
  for (const [chainKey, extraList] of extras) {
    const merged = out.get(chainKey) ?? [];
    const seen = new Set(merged.map((t) => t.address.toLowerCase()));
    for (const t of extraList) {
      const lower = t.address.toLowerCase();
      if (seen.has(lower)) continue;
      seen.add(lower);
      merged.push(t);
    }
    out.set(chainKey, merged);
  }
  return out;
}

function readPersisted(): CatalogState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as PersistedSnapshot;
    if (parsed.v !== SNAPSHOT_VERSION || !Array.isArray(parsed.chains)) {
      return emptyState();
    }
    const tokensByChainKey = new Map(Object.entries(parsed.tokensByChainKey));
    const extras = new Map<string, Token[]>();
    return {
      chains: parsed.chains,
      tokensByChainKey,
      extraTokensByChainKey: extras,
      mergedByChainKey: rebuildMerged(tokensByChainKey, extras),
      ready: parsed.chains.length > 0,
      fetchedAt: parsed.fetchedAt,
    };
  } catch {
    return emptyState();
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
      // Preserve any session-scoped extras across catalog refreshes.
      const extras = state.extraTokensByChainKey;
      state = {
        chains: data.chains ?? [],
        tokensByChainKey,
        extraTokensByChainKey: extras,
        mergedByChainKey: rebuildMerged(tokensByChainKey, extras),
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
  return state.mergedByChainKey.get(chainKey) ?? EMPTY_TOKENS;
}

export function getToken(chainKey: string, symbol: string): Token | undefined {
  return getTokensFor(chainKey).find((t) => t.symbol === symbol);
}

export function getTokenByAddress(chainKey: string, address: string): Token | undefined {
  const lower = address.toLowerCase();
  return getTokensFor(chainKey).find((t) => t.address.toLowerCase() === lower);
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

/**
 * Register a long-tail token surfaced by /api/v1/tokens/search so it's part
 * of the chain's token list for the rest of the session. Dedup by lowercased
 * address against the curated set + any existing extras. No-op if already
 * present. Not persisted to localStorage — extras are session-scoped.
 */
export function addExtraToken(chainKey: string, token: Token): void {
  const lower = token.address.toLowerCase();
  const curated = state.tokensByChainKey.get(chainKey);
  if (curated && curated.some((t) => t.address.toLowerCase() === lower)) return;
  const existing = state.extraTokensByChainKey.get(chainKey) ?? [];
  if (existing.some((t) => t.address.toLowerCase() === lower)) return;
  const nextExtras = new Map(state.extraTokensByChainKey);
  nextExtras.set(chainKey, [...existing, token]);
  state = {
    ...state,
    extraTokensByChainKey: nextExtras,
    mergedByChainKey: rebuildMerged(state.tokensByChainKey, nextExtras),
  };
  emit();
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
