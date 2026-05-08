import { resolveApiBaseUrl } from '../lib/apiBaseUrl';
import type { Token, TokenTag } from '../lib/catalog';

/** Token shape returned by /api/v1/tokens/search. Adds provider attribution
 *  and an isFeatured marker on top of the catalog Token shape. */
export interface SearchToken extends Token {
  providers: string[];
  isFeatured: boolean;
}

export interface SearchResponse {
  chainId: number;
  tokens: Array<SearchToken & { tags?: TokenTag[] }>;
  sources: string[];
  fetchedAt: string;
}

/** Frontend response cache: avoids re-hitting the backend for queries the
 *  user just typed (e.g. typed "usd", deleted, retyped "usd" within a
 *  minute). Backend already has its own 10-min cache, but a roundtrip is
 *  ~30-60ms — caching here drops it to <1ms on repeats. Reviewer-flagged
 *  optimization. Keys are normalised so case + whitespace don't fragment. */
const RESPONSE_TTL_MS = 60 * 1000;
const responseCache = new Map<string, { response: SearchResponse; fetchedAt: number }>();

function cacheKey(chainId: number, q: string, limit: number): string {
  return `${chainId}:${q.trim().toLowerCase()}:${limit}`;
}

export function clearTokenSearchResponseCache(): void {
  responseCache.clear();
}

export async function searchTokensApi(
  chainId: number,
  q: string,
  limit: number,
  signal?: AbortSignal,
): Promise<SearchResponse> {
  const key = cacheKey(chainId, q, limit);
  const now = Date.now();
  const hit = responseCache.get(key);
  if (hit && now - hit.fetchedAt < RESPONSE_TTL_MS) {
    return hit.response;
  }

  const base = resolveApiBaseUrl();
  const params = new URLSearchParams({
    chainId: String(chainId),
    q,
    limit: String(limit),
  });
  const url = `${base}/tokens/search?${params.toString()}`;
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`token search failed (${response.status})`);
  }
  const body = (await response.json()) as SearchResponse;
  responseCache.set(key, { response: body, fetchedAt: Date.now() });
  return body;
}
