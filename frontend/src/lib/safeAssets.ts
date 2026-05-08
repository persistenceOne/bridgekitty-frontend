import { useSyncExternalStore } from 'react';
import type { TokenOption, TokenTag } from './chains';

const STORAGE_KEY = 'bk.safeAssetsOnly';
const DEFAULT_ON = true;

const SAFE_TAGS: ReadonlySet<TokenTag> = new Set(['native', 'btc-variant', 'stablecoin']);

function readInitial(): boolean {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_ON;
    return raw === 'true';
  } catch {
    return DEFAULT_ON;
  }
}

let value = readInitial();
const listeners = new Set<() => void>();

export function getSafeAssetsOnly(): boolean {
  return value;
}

export function setSafeAssetsOnly(next: boolean): void {
  if (next === value) return;
  value = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    // private mode / storage disabled — keep the in-memory value, swallow the error
  }
  listeners.forEach((fn) => fn());
}

export function toggleSafeAssetsOnly(): void {
  setSafeAssetsOnly(!value);
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useSafeAssetsOnly(): boolean {
  return useSyncExternalStore(subscribe, getSafeAssetsOnly, getSafeAssetsOnly);
}

export function isSafeToken(t: TokenOption): boolean {
  return !!t.tags?.some((tag) => SAFE_TAGS.has(tag));
}

export function filterSafe(tokens: TokenOption[], on: boolean): TokenOption[] {
  return on ? tokens.filter(isSafeToken) : tokens;
}
