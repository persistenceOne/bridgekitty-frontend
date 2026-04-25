import { type ChainKey, getToken } from '../lib/chains';
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
  /** Persistence trackingId (e.g. "lifi:0xabc..." or "debridge:0xorderhash").
   *  Passed as the `provider` param when polling /status so the backend can
   *  forward it directly to the Persistence status endpoint. */
  trackingId?: string;
  route: string;
  feeUsd: number;
  /** deBridge-specific: the DLN solver fee in USD charged on top of the swap
   *  (paid in the source chain's native token). Undefined for other providers. */
  fixFeeUsd?: number;
  /** BridgeKitty's own fee in USD (Persistence integrator-fee pass-through).
   *  Undefined when no integrator fee is configured upstream. */
  integratorFeeUsd?: number;
  etaSeconds: number;
  destinationAmount: string;
  destinationAmountMin?: string;
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

function numberFromUnknown(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseAmountFromQuote(value: unknown, decimals: number): string {
  if (typeof value !== 'string') {
    return '0';
  }

  try {
    return formatUnits(BigInt(value), decimals, 6);
  } catch {
    return '0';
  }
}

function resolveQuoteUrl(): string {
  const directProxy = import.meta.env.VITE_BRIDGEKITTY_QUOTE_PROXY_URL;
  if (directProxy && directProxy.trim().length > 0) {
    return directProxy;
  }

  const base = resolveApiBaseUrl();
  if (base) {
    return `${base}/quotes`;
  }

  return '';
}

/** Error thrown by getSwapQuote that carries the upstream HTTP status so the
 *  caller (useSwapQuotes) can decide whether to retry. 4xx (especially 409
 *  "already being executed") should never retry — the condition is not
 *  transient and retrying just piles onto the upstream cache collision. */
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

async function fetchQuoteFromBackend(
  payload: Record<string, unknown>,
  signal?: AbortSignal
): Promise<unknown> {
  const quoteUrl = resolveQuoteUrl();

  if (!quoteUrl) {
    throw new QuoteFetchError('Backend quote URL unavailable.', 0);
  }

  let response: Response;
  try {
    response = await fetch(quoteUrl, {
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
      errorText || `Quote proxy returned ${response.status}`,
      response.status
    );
  }

  return response.json();
}

type ProviderKey = 'lifi' | 'debridge' | 'squid' | 'relay' | 'across';

interface BackendQuoteShape {
  id: string;
  trackingId?: string;
  routeSteps?: Array<{ type?: string }>;
  feeUsd?: string;
  fixFeeUsd?: string;
  integratorFeeUsd?: string;
  duration?: { estimated?: string | null };
  dstAmount?: string;
  dstAmountMin?: string;
  userSteps?: Array<{
    type?: string;
    transaction?: {
      to?: string;
      data?: string;
      value?: string;
      gas?: string;
      gasLimit?: string;
      gasPrice?: string;
      maxFeePerGas?: string;
      maxPriorityFeePerGas?: string;
    };
  }>;
}

const PROVIDER_API_KEY: Record<ProviderKey, QuoteResult['provider']> = {
  lifi: 'lifi-api',
  debridge: 'debridge-api',
  squid: 'squid-api',
  relay: 'relay-api',
  across: 'across-api',
};

function normalizeBackendQuote(
  raw: BackendQuoteShape,
  provider: ProviderKey,
  toTokenDecimals: number
): QuoteResult {
  const route = raw.routeSteps?.map((s) => s.type).filter(Boolean).join(' + ') ?? provider.toUpperCase();
  const etaMs = numberFromUnknown(raw.duration?.estimated, 90000);
  const rawTx = raw.userSteps?.find((s) => s.type === 'TRANSACTION')?.transaction;
  const transactionRequest = rawTx
    ? {
        to: rawTx.to,
        data: rawTx.data,
        value: rawTx.value,
        gasLimit: rawTx.gasLimit ?? rawTx.gas,
        gasPrice: rawTx.gasPrice,
        maxFeePerGas: rawTx.maxFeePerGas,
        maxPriorityFeePerGas: rawTx.maxPriorityFeePerGas,
      }
    : undefined;

  const fixFeeUsdRaw = numberFromUnknown(raw.fixFeeUsd, 0);
  const integratorFeeUsdRaw = numberFromUnknown(raw.integratorFeeUsd, 0);

  return {
    id: raw.id,
    provider: PROVIDER_API_KEY[provider],
    trackingId: raw.trackingId,
    route,
    feeUsd: numberFromUnknown(raw.feeUsd, 0),
    fixFeeUsd: fixFeeUsdRaw > 0 ? fixFeeUsdRaw : undefined,
    integratorFeeUsd: integratorFeeUsdRaw > 0 ? integratorFeeUsdRaw : undefined,
    etaSeconds: Math.max(15, Math.round(etaMs / 1000)),
    destinationAmount: parseAmountFromQuote(raw.dstAmount, toTokenDecimals),
    destinationAmountMin: parseAmountFromQuote(raw.dstAmountMin, toTokenDecimals),
    transactionRequest,
    raw,
  };
}

export interface AllQuotesResult {
  quotes: Partial<Record<ProviderKey, QuoteResult>>;
  failed: Partial<Record<ProviderKey, string>>;
}

/**
 * Fetch quotes from every supported provider in a single backend call.
 *
 * The backend hits Persistence's `/quote` once and runs `/execute` per
 * provider in parallel — so this single HTTP round-trip returns whatever
 * subset of {LI.FI, Squid, deBridge, Relay, Across} actually has a route
 * for the requested pair, with the failed ones listed in `failed` so the
 * UI can decide what to show.
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

  const amountInUnits = parseUnits(request.amount, fromToken.decimals).toString();
  const wallet = request.walletAddress || NULL_ADDRESS;

  const payload = {
    srcChainKey: request.fromChain,
    dstChainKey: request.toChain,
    srcTokenAddress: fromToken.address,
    dstTokenAddress: toToken.address,
    srcWalletAddress: wallet,
    dstWalletAddress: wallet,
    amount: amountInUnits,
  };

  const data = (await fetchQuoteFromBackend(payload, signal)) as {
    quotes?: Partial<Record<ProviderKey, BackendQuoteShape>>;
    failed?: Partial<Record<ProviderKey, string>>;
  };

  const quotes: Partial<Record<ProviderKey, QuoteResult>> = {};
  for (const [provider, rawQuote] of Object.entries(data.quotes ?? {})) {
    if (rawQuote) {
      quotes[provider as ProviderKey] = normalizeBackendQuote(
        rawQuote,
        provider as ProviderKey,
        toToken.decimals
      );
    }
  }

  return { quotes, failed: data.failed ?? {} };
}

