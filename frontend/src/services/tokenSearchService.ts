import { resolveApiBaseUrl } from '../lib/apiBaseUrl';
import type { Token, TokenTag } from '../lib/catalog';

/** Token shape returned by /api/v1/tokens/search. Adds provider attribution
 *  and an isFeatured marker on top of the catalog Token shape. */
export interface SearchToken extends Token {
  providers: string[];
  isFeatured: boolean;
}

interface SearchResponse {
  chainId: number;
  tokens: Array<SearchToken & { tags?: TokenTag[] }>;
  sources: string[];
  fetchedAt: string;
}

export async function searchTokensApi(
  chainId: number,
  q: string,
  limit: number,
  signal?: AbortSignal,
): Promise<SearchResponse> {
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
  return response.json();
}
