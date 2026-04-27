import { type ChainKey, CHAIN_BY_KEY, getToken } from '../lib/chains';
import { formatUnits, parseUnits } from '../lib/amount';
import { resolveApiBaseUrl } from '../lib/apiBaseUrl';

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

export interface QuoteRequest {
  fromChain: ChainKey;
  toChain: ChainKey;
  fromTokenSymbol: string;
  toTokenSymbol: string;
  amount: string;
  walletAddress?: string | null;
}

export interface QuoteResult {
  id: string;
  provider: 'lifi-api' | 'debridge-api' | 'squid-api' | 'relay-api' | 'across-api' | 'mock';
  /** bridgekitty-backend trackingId returned from /execute (e.g. "lifi:0xabc...").
   *  Populated by `executeQuote()`; undefined on the bare quote returned from /quote. */
  trackingId?: string;
  route: string;
  feeUsd: number;
  /** deBridge-specific: native-token protocol fee (fixFee) converted to USD. */
  fixFeeUsd?: number;
  /** Integrator fee (BridgeKitty's own fee), undefined when not configured upstream. */
  integratorFeeUsd?: number;
  etaSeconds: number;
  destinationAmount: string;
  destinationAmountMin?: string;
  /** Only populated AFTER `executeQuote(id)` has been called. The /quote endpoint
   *  no longer returns the raw transaction — the user must select a quote first. */
  transactionRequest?: {
    to?: string;
    data?: string;
    value?: string;
    gasLimit?: string;
    gasPrice?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
  };
  warning?: string;
  raw?: unknown;
}

type ProviderKey = 'lifi' | 'debridge' | 'squid' | 'relay' | 'across';

const PROVIDER_API_KEY: Record<ProviderKey, QuoteResult['provider']> = {
  lifi: 'lifi-api',
  debridge: 'debridge-api',
  squid: 'squid-api',
  relay: 'relay-api',
  across: 'across-api',
};

function normalizeBackendName(name: string): ProviderKey | null {
  const lower = name.toLowerCase();
  if (lower.startsWith('lifi')) return 'lifi';
  if (lower.startsWith('debridge')) return 'debridge';
  if (lower.startsWith('squid')) return 'squid';
  if (lower.startsWith('relay')) return 'relay';
  if (lower.startsWith('across')) return 'across';
  return null;
}

function parseAmountFromQuote(value: unknown, decimals: number): string {
  if (typeof value !== 'string') return '0';
  try {
    return formatUnits(BigInt(value), decimals, 6);
  } catch {
    return '0';
  }
}

/** Error thrown by quote/execute calls that carries the upstream HTTP status. */
export class QuoteFetchError extends Error {
  readonly status: number;
  readonly isAbort: boolean;
  constructor(message: string, status: number, isAbort = false) {
    super(message);
    this.name = 'QuoteFetchError';
    this.status = status;
    this.isAbort = isAbort;
  }
}

async function postJson<T>(
  url: string,
  payload: Record<string, unknown>,
  signal?: AbortSignal
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new QuoteFetchError('Quote request aborted.', 0, true);
    }
    throw new QuoteFetchError(err instanceof Error ? err.message : String(err), 0);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new QuoteFetchError(
      errorText || `Request failed (${response.status})`,
      response.status
    );
  }

  return response.json() as Promise<T>;
}

interface BackendQuote {
  quoteId: string;
  provider: string;       // human-readable, e.g. "Stargate via LI.FI"
  backendName: string;    // machine name, e.g. "lifi"
  outputAmount: string;
  outputAmountRaw: string;
  minOutputAmount: string;
  minOutputAmountRaw: string;
  outputDecimals?: number;
  estimatedGasCostUsd: number | null;
  estimatedFeeUsd: number | null;
  feeBreakdown: {
    gasCostUsd: number | null;
    protocolFeeUsd: number;
    integratorFeeUsd: number;
    integratorFeePercent: string | null;
    totalFeeUsd: number | null;
    fixFeeNativeRaw?: string;
    fixFeeUsd?: number;
    operatingExpenseRaw?: string;
    totalSourceAmountRaw?: string;
  };
  estimatedTimeSeconds: number;
  route: string;
  expiresAt: number;
  ttlExpiresAt: number;
}

interface FailedProvider {
  provider: string;
  reason: string;
}

interface QuoteResponse {
  durationMs: number;
  failedProviders: FailedProvider[];
  quotes: BackendQuote[];
}

function quoteToResult(q: BackendQuote, providerKey: ProviderKey, toDecimals: number): QuoteResult {
  return {
    id: q.quoteId,
    provider: PROVIDER_API_KEY[providerKey],
    route: q.route ?? q.provider ?? providerKey.toUpperCase(),
    feeUsd: q.estimatedFeeUsd ?? 0,
    fixFeeUsd: q.feeBreakdown?.fixFeeUsd && q.feeBreakdown.fixFeeUsd > 0 ? q.feeBreakdown.fixFeeUsd : undefined,
    integratorFeeUsd:
      q.feeBreakdown?.integratorFeeUsd && q.feeBreakdown.integratorFeeUsd > 0
        ? q.feeBreakdown.integratorFeeUsd
        : undefined,
    etaSeconds: Math.max(15, Math.round(q.estimatedTimeSeconds)),
    destinationAmount: parseAmountFromQuote(q.outputAmountRaw, toDecimals),
    destinationAmountMin: parseAmountFromQuote(q.minOutputAmountRaw, toDecimals),
    transactionRequest: undefined,
    raw: q,
  };
}

export interface AllQuotesResult {
  quotes: Partial<Record<ProviderKey, QuoteResult>>;
  failed: Partial<Record<ProviderKey, string>>;
}

/**
 * Fetch quotes from every supported provider in a single backend call.
 *
 * Hits bridgekitty-backend's `POST /quote` once and groups the returned
 * `quotes[]` by `backendName` to keep the existing per-provider API shape
 * the UI expects. The transaction itself is NOT returned here — call
 * `executeQuote(quoteId)` after the user picks a route.
 */
export async function getAllSwapQuotes(
  request: QuoteRequest,
  signal?: AbortSignal
): Promise<AllQuotesResult> {
  if (request.fromChain === request.toChain && request.fromTokenSymbol === request.toTokenSymbol) {
    throw new Error('Source and destination tokens must be different for a same-chain swap.');
  }

  const fromToken = getToken(request.fromChain, request.fromTokenSymbol);
  const toToken = getToken(request.toChain, request.toTokenSymbol);
  if (!fromToken || !toToken) {
    throw new Error('Unsupported token for selected chain.');
  }

  const fromChainId = CHAIN_BY_KEY[request.fromChain]?.chainId;
  const toChainId = CHAIN_BY_KEY[request.toChain]?.chainId;
  if (!fromChainId || !toChainId) {
    throw new Error('Unsupported chain for selected route.');
  }

  const amountInUnits = parseUnits(request.amount, fromToken.decimals).toString();
  const wallet = request.walletAddress || NULL_ADDRESS;

  const base = resolveApiBaseUrl();
  if (!base) throw new QuoteFetchError('Backend quote URL unavailable.', 0);

  const payload = {
    fromChainId,
    toChainId,
    fromTokenAddress: fromToken.address,
    toTokenAddress: toToken.address,
    amount: amountInUnits,
    fromAddress: wallet,
    toAddress: wallet,
    preference: 'cheapest',
  };

  const data = await postJson<QuoteResponse>(`${base}/quote`, payload, signal);

  const quotes: Partial<Record<ProviderKey, QuoteResult>> = {};
  // Take the best-ranked quote per provider (the array is already sorted by preference)
  for (const q of data.quotes ?? []) {
    const key = normalizeBackendName(q.backendName);
    if (!key) continue;
    if (!quotes[key]) {
      quotes[key] = quoteToResult(q, key, toToken.decimals);
    }
  }

  const failed: Partial<Record<ProviderKey, string>> = {};
  for (const fp of data.failedProviders ?? []) {
    const key = normalizeBackendName(fp.provider);
    if (key) failed[key] = fp.reason;
  }

  return { quotes, failed };
}

interface ExecuteResponse {
  quoteId: string;
  provider: string;
  trackingId: string;
  transaction: {
    to: string;
    data: string;
    value: string;
    chainId: number;
    gasLimit?: string;
  };
  approvalTransaction?: {
    to: string;
    data: string;
    value: string;
    chainId: number;
  };
  needsPostApprovalBuild?: boolean;
  eip712?: unknown;
  solanaTransaction?: { serializedTx?: string } | null;
}

export interface ExecutedQuote {
  trackingId: string;
  transactionRequest: NonNullable<QuoteResult['transactionRequest']>;
  approvalTransaction?: NonNullable<ExecuteResponse['approvalTransaction']>;
  needsPostApprovalBuild?: boolean;
}

/**
 * Build the executable transaction for a quoteId. Idempotent on the backend —
 * concurrent calls for the same quoteId share the same payload (no 409s).
 */
export async function executeQuote(quoteId: string, signal?: AbortSignal): Promise<ExecutedQuote> {
  const base = resolveApiBaseUrl();
  if (!base) throw new QuoteFetchError('Backend API URL unavailable.', 0);

  const data = await postJson<ExecuteResponse>(`${base}/execute`, { quoteId }, signal);

  return {
    trackingId: data.trackingId,
    transactionRequest: {
      to: data.transaction.to,
      data: data.transaction.data,
      value: data.transaction.value,
      gasLimit: data.transaction.gasLimit,
    },
    approvalTransaction: data.approvalTransaction,
    needsPostApprovalBuild: data.needsPostApprovalBuild,
  };
}
