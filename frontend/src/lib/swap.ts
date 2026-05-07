import { CHAINS, CHAIN_BY_KEY, getDefaultToken, getToken, type ChainKey } from './chains';
import type { SwapDraft } from '../types';

export function makeBalanceKey(chain: ChainKey, tokenAddress: string): string {
  return `${chain}:${tokenAddress.toLowerCase()}`;
}

export function toProviderLabel(provider?: string): string {
  if (!provider) return 'Unknown';
  return provider.replace(/-api$/i, '').replace(/^./, (char) => char.toUpperCase());
}

export function getAnotherChain(chain: ChainKey): ChainKey {
  const allKeys = CHAINS.map((c) => c.key);
  const idx = allKeys.indexOf(chain);
  return allKeys[(idx + 1) % allKeys.length];
}

export function getDifferentToken(chain: ChainKey, excludeSymbol: string): string {
  const tokens = CHAIN_BY_KEY[chain].tokens;
  const other = tokens.find((t) => t.symbol !== excludeSymbol);
  return other?.symbol ?? tokens[0].symbol;
}

export function resolveToken(chain: ChainKey, preferred?: string, fallback?: string): string {
  if (preferred && getToken(chain, preferred)) return preferred;
  if (fallback && getToken(chain, fallback)) return fallback;
  return getDefaultToken(chain).symbol;
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

/** Hard cap on `gasLimit` — even the most complex multi-hop bridge txs
 *  comfortably fit under 15M gas. Anything beyond this is either malformed
 *  or adversarial (gas-griefing). */
const MAX_GAS_LIMIT = 15_000_000n;

/** Cap on the native `value` for ERC-20 source swaps. Some providers (e.g.
 *  deBridge) charge a small native-denominated solver fee on top of an
 *  ERC-20 swap, which is legitimate; anything above 1 native unit (1e18 wei)
 *  is unreasonable for a fee and likely a backend tampering attempt. */
const MAX_ERC20_NATIVE_FEE_WEI = 1_000_000_000_000_000_000n; // 1e18

/** Slack allowed on top of the user-entered native amount. Same rationale
 *  as `MAX_ERC20_NATIVE_FEE_WEI`: covers fixed solver fees but blocks gross
 *  over-payment. */
const MAX_NATIVE_FEE_OVERAGE_WEI = 1_000_000_000_000_000_000n; // 1e18

interface ValidateTxOptions {
  /** chainId the user is bridging FROM. Must match the backend's response. */
  expectedChainId: number;
  /** Whether the source token is the chain's native gas asset. Affects the
   *  permitted `value` envelope: native swaps must include at least the
   *  requested amount; ERC-20 swaps should send only a small fee (or zero). */
  isNativeSource: boolean;
  /** The wei-denominated amount the user requested. Required when
   *  `isNativeSource` is true, ignored otherwise. */
  requestedAmountWei?: bigint;
}

function parseValueToBigInt(value: string | undefined): bigint | null {
  if (value == null) return 0n; // missing value defaults to 0 (ERC-20 path)
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

/**
 * Validates that a transaction request from an external API is safe to sign.
 *
 * Layered defences (each catches a different class of backend tampering):
 *   1. `to` is a real, non-zero EVM address.
 *   2. `data` is present and not a bare selector.
 *   3. `chainId` matches the chain the user explicitly selected — guards
 *      against same-address-different-chain attacks.
 *   4. `value` is bounded: native-source swaps must equal `requestedAmount`
 *      plus at most one native unit of solver fee; ERC-20 swaps must send
 *      at most one native unit total.
 *   5. `gasLimit` is bounded — prevents gas-griefing via absurd estimates.
 */
export function validateTransactionRequest(
  tx: {
    to?: string;
    data?: string;
    value?: string;
    gasLimit?: string;
    chainId?: number;
  },
  options: ValidateTxOptions
): string | null {
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

  // chainId — strict equality. The user picked a chain; if the backend
  // returns a tx for a different one, refuse. Note: `tx.chainId` from
  // `/execute` is authoritative; a missing value means we cannot verify
  // and therefore must refuse.
  if (typeof tx.chainId !== 'number' || tx.chainId !== options.expectedChainId) {
    return 'Transaction chain mismatch — refusing to sign.';
  }

  // value — bound based on swap type
  const valueWei = parseValueToBigInt(tx.value ?? '0x0');
  if (valueWei == null || valueWei < 0n) {
    return 'Transaction value is malformed.';
  }

  if (options.isNativeSource) {
    if (options.requestedAmountWei == null) {
      // Caller-side bug; treat conservatively.
      return 'Internal error: missing requested amount for native swap.';
    }
    if (valueWei < options.requestedAmountWei) {
      return 'Transaction would send less than the requested amount.';
    }
    const overage = valueWei - options.requestedAmountWei;
    if (overage > MAX_NATIVE_FEE_OVERAGE_WEI) {
      return 'Transaction value exceeds expected amount by too much.';
    }
  } else {
    // ERC-20 source: native value should be 0 or a small fixed-fee amount.
    if (valueWei > MAX_ERC20_NATIVE_FEE_WEI) {
      return 'Transaction value too high for an ERC-20 swap.';
    }
  }

  // gasLimit — upper bound (lower bound is enforced by the wallet).
  if (tx.gasLimit) {
    const gas = parseValueToBigInt(tx.gasLimit);
    if (gas == null || gas < 0n) {
      return 'Transaction gas limit is malformed.';
    }
    if (gas > MAX_GAS_LIMIT) {
      return 'Transaction gas limit is unreasonably high.';
    }
  }

  return null; // valid
}
