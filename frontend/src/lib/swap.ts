import {
  getChains,
  getDefaultToken,
  getToken,
  getTokensFor,
} from './catalogStore';
import type { ChainKey, TokenOption } from './chains';
import type { SwapDraft } from '../types';

/** Find a token in a chain's token list, preferring address-based match (for
 *  long-tail tokens that may share a symbol with a curated entry) and
 *  falling back to symbol-based match. */
export function matchToken(
  tokens: TokenOption[],
  symbol: string,
  address?: string,
): TokenOption | undefined {
  if (address) {
    const lower = address.toLowerCase();
    const byAddr = tokens.find((t) => t.address.toLowerCase() === lower);
    if (byAddr) return byAddr;
  }
  return tokens.find((t) => t.symbol === symbol);
}

export function makeBalanceKey(chain: ChainKey, tokenAddress: string): string {
  return `${chain}:${tokenAddress.toLowerCase()}`;
}

export function toProviderLabel(provider?: string): string {
  if (!provider) return 'Unknown';
  return provider.replace(/-api$/i, '').replace(/^./, (char) => char.toUpperCase());
}

export function getAnotherChain(chain: ChainKey): ChainKey {
  const allKeys = getChains().map((c) => c.key);
  const idx = allKeys.indexOf(chain);
  if (idx === -1) return allKeys[0] ?? chain;
  return allKeys[(idx + 1) % allKeys.length];
}

export function getDifferentToken(chain: ChainKey, excludeSymbol: string): string {
  const tokens = getTokensFor(chain);
  const other = tokens.find((t) => t.symbol !== excludeSymbol);
  return other?.symbol ?? tokens[0]?.symbol ?? excludeSymbol;
}

export function resolveToken(chain: ChainKey, preferred?: string, fallback?: string): string {
  if (preferred && getToken(chain, preferred)) return preferred;
  if (fallback && getToken(chain, fallback)) return fallback;
  return getDefaultToken(chain)?.symbol ?? preferred ?? fallback ?? '';
}

export function toHexQuantity(value?: string): string | undefined {
  if (!value) return undefined;
  if (value.startsWith('0x')) return value;
  try {
    return `0x${BigInt(value).toString(16)}`;
  } catch {
    return undefined;
  }
}

export function isValidSwapInput(draft: SwapDraft): boolean {
  if (draft.fromChain === draft.toChain && draft.fromTokenSymbol === draft.toTokenSymbol) return false;
  const amount = Number(draft.amount);
  return Number.isFinite(amount) && amount > 0;
}

const ETH_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/**
 * Validates that a transaction request from an external API has safe fields
 * before the user signs it. Prevents malicious `to` addresses or missing data.
 */
export function validateTransactionRequest(tx: {
  to?: string;
  data?: string;
  value?: string;
}): string | null {
  if (!tx.to || !ETH_ADDRESS_RE.test(tx.to)) {
    return 'Invalid transaction target address.';
  }
  // Refuse to sign a burn: a quote whose `to` is the zero address would
  // destroy any `value` included. Only possible if upstream is broken.
  if (tx.to.toLowerCase() === ZERO_ADDRESS) {
    return 'Invalid transaction target address (zero address).';
  }
  if (!tx.data || tx.data.length < 10) {
    return 'Transaction data is missing or malformed.';
  }
  return null; // valid
}
