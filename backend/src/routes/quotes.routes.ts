import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const router = Router();

// 30 requests / minute per IP — only enforced outside development
const quoteLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'development',
  message: { error: 'Too many quote requests. Please wait a moment before trying again.' }
});

const SUPPORTED_PROVIDERS = ['lifi', 'debridge', 'squid', 'relay', 'across'] as const;
type SupportedProvider = typeof SUPPORTED_PROVIDERS[number];

const CHAIN_ID_BY_KEY: Record<string, number> = {
  ethereum: 1,
  base:     8453,
  bsc:      56,
  polygon:  137,
  monad:    143,
};

// Persistence uses 0x0000...0000 for native tokens.
// Our frontend uses 0xEeee...EeEe. Normalize before sending upstream.
const EEE_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

function normalizeTokenAddress(address: string): string {
  return address.toLowerCase() === EEE_ADDRESS ? ZERO_ADDRESS : address;
}

function resolveChainId(key?: string): number | undefined {
  if (!key) return undefined;
  if (key in CHAIN_ID_BY_KEY) return CHAIN_ID_BY_KEY[key];
  const numeric = Number(key);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
}

interface PersistenceQuote {
  quoteId:              string;
  provider:             string;
  backendName:          string;
  // Human-readable decimal strings
  outputAmount:         string;
  minOutputAmount?:     string;
  outputDecimals?:      number;
  // Raw integer unit strings — use these for on-chain amounts
  outputAmountRaw?:     string;
  minOutputAmountRaw?:  string;
  estimatedFeeUsd?:     number;
  estimatedGasCostUsd?: number;
  estimatedTimeSeconds?: number;
  route?:               string;
  feeBreakdown?: {
    totalFeeUsd?:          number;
    gasCostUsd?:           number;
    // deBridge splits protocol cost into fixFee (solver) + operatingExpense.
    // `protocolFeeUsd` is the combined DLN protocol cost; `fixFeeUsd` is
    // specifically the fixed DLN solver fee paid in the source chain's native
    // token. Other providers return `protocolFeeUsd` but no `fixFeeUsd`.
    protocolFeeUsd?:       number;
    fixFeeUsd?:            number;
    fixFeeNativeRaw?:      string;
    operatingExpenseRaw?:  string;
    integratorFeeUsd?:     number;
    integratorFeePercent?: string | null;
  };
}

interface PersistenceExecuteResult {
  quoteId:     string;
  provider:    string;
  trackingId:  string;
  transaction?: {
    to:                    string;
    data:                  string;
    value:                 string;
    chainId?:              number;
    gasLimit?:             string;
    gasPrice?:             string;
    maxFeePerGas?:         string;
    maxPriorityFeePerGas?: string;
  };
  approvalTransaction?: unknown; // handled client-side by ensureTokenApproval
}

class UpstreamError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'UpstreamError';
    this.status = status;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Call Persistence `/execute` and recover from 409 "already being executed"
 * by waiting briefly and retrying. The 409 is transient — once the previous
 * caller's execution settles, Persistence returns the cached result for the
 * same `quoteId` rather than re-running it.
 */
async function executeWithRecovery(
  quoteId: string,
  attempts = 3
): Promise<PersistenceExecuteResult> {
  for (let i = 1; i <= attempts; i++) {
    const resp = await fetch(`${env.PERSISTENCE_API_BASE_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quoteId }),
    });
    const text = await resp.text();
    if (resp.ok) {
      return JSON.parse(text) as PersistenceExecuteResult;
    }
    if (resp.status === 409 && i < attempts) {
      await sleep(700 * i); // 700ms, 1400ms
      continue;
    }
    // Surface the upstream status so the route handler can forward 409 as 409
    // (not 502) and the frontend skips its blind retry.
    throw new UpstreamError(`Persistence /execute failed (${resp.status}): ${text}`, resp.status);
  }
  throw new UpstreamError('Persistence /execute failed after retries.', 503);
}

interface UpstreamQuoteBody {
  fromChainId: number;
  toChainId: number;
  fromTokenAddress: string;
  toTokenAddress: string;
  amount: string;
  fromAddress: string;
  toAddress: string;
}

interface UpstreamQuoteResponse {
  quotes?: PersistenceQuote[];
  failedProviders?: Array<{ provider: string; reason: string }>;
}

/**
 * In-flight dedup of the upstream `/quote` call.
 *
 * Persistence's `/quote` returns ALL provider quotes in a single response —
 * one call gives us LI.FI, Squid, deBridge, Relay, Across, etc. all at once.
 * Previously we made 5 separate `/quote` calls (one per provider with a
 * `providers: [X]` filter), which (a) wasted 4 upstream calls per round,
 * (b) made each per-provider response collide on Persistence's quoteId
 * cache, and (c) when one provider had no route, surfaced the misleading
 * "filtered out by providers parameter" message from a different provider's
 * failedProviders entry.
 *
 * Now: one upstream `/quote` per round, shared by all 5 concurrent backend
 * handlers via this in-flight Map. Each handler then picks the cheapest
 * quote whose `backendName` matches its provider, and only its own
 * `/execute` call hits upstream — and since each provider gets a different
 * `quoteId`, there are no `/execute` 409 collisions across providers within
 * the same round.
 */
const upstreamQuoteInflight = new Map<string, Promise<UpstreamQuoteResponse>>();

function upstreamQuoteKey(body: UpstreamQuoteBody): string {
  return [
    body.fromChainId,
    body.toChainId,
    body.fromTokenAddress.toLowerCase(),
    body.toTokenAddress.toLowerCase(),
    body.amount,
    body.fromAddress.toLowerCase(),
    body.toAddress.toLowerCase(),
  ].join('|');
}

async function getUpstreamQuotes(body: UpstreamQuoteBody): Promise<UpstreamQuoteResponse> {
  const key = upstreamQuoteKey(body);
  let work = upstreamQuoteInflight.get(key);
  if (work) return work;

  work = (async () => {
    const resp = await fetch(`${env.PERSISTENCE_API_BASE_URL}/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // No `providers` filter — we want every backend's quotes in one shot
      // and split them ourselves by `backendName`.
      body: JSON.stringify({ ...body, preference: 'cheapest' }),
    });
    const text = await resp.text();
    if (!resp.ok) {
      throw new UpstreamError(`Persistence /quote failed (${resp.status}): ${text}`, resp.status);
    }
    return JSON.parse(text) as UpstreamQuoteResponse;
  })().finally(() => {
    upstreamQuoteInflight.delete(key);
  });

  upstreamQuoteInflight.set(key, work);
  return work;
}

function pickBestQuoteForProvider(
  data: UpstreamQuoteResponse,
  provider: SupportedProvider
): { quote: PersistenceQuote } | { error: UpstreamError } {
  const candidates = (data.quotes ?? []).filter((q) => q.backendName === provider);

  if (candidates.length === 0) {
    // Find the failedProviders entry that actually matches OUR provider —
    // not just `[0]`, which would surface someone else's "filtered out" message
    // when the providers filter is in play.
    const matched = data.failedProviders?.find((f) => f.provider === provider);
    const reason = matched?.reason ?? 'No route available for this token pair.';
    return { error: new UpstreamError(reason, 404) };
  }

  // Pick the cheapest by total fee USD; fall back to estimatedFeeUsd; then
  // highest output amount as a tiebreak.
  const best = candidates.reduce((a, b) => {
    const af = a.feeBreakdown?.totalFeeUsd ?? a.estimatedFeeUsd ?? Infinity;
    const bf = b.feeBreakdown?.totalFeeUsd ?? b.estimatedFeeUsd ?? Infinity;
    if (af !== bf) return af < bf ? a : b;
    const ao = BigInt(a.outputAmountRaw ?? '0');
    const bo = BigInt(b.outputAmountRaw ?? '0');
    return ao >= bo ? a : b;
  });

  return { quote: best };
}

/**
 * Normalize a Persistence quote + execute pair into our unified response shape.
 * The frontend quoteService.ts parses this structure.
 */
function buildQuoteResponse(
  quote: PersistenceQuote,
  exec:  PersistenceExecuteResult,
  _provider: SupportedProvider
): Record<string, unknown> {
  const totalFeeUsd = quote.feeBreakdown?.totalFeeUsd ?? quote.estimatedFeeUsd ?? 0;
  const etaMs       = Math.max(1_000, (quote.estimatedTimeSeconds ?? 90) * 1_000);

  // Use raw integer units for amounts — quoteService.ts calls BigInt() on these.
  // Persistence also returns human-readable `outputAmount` but BigInt("0.0099") throws.
  const dstAmount    = quote.outputAmountRaw ?? null;
  const dstAmountMin = quote.minOutputAmountRaw ?? quote.outputAmountRaw ?? null;

  // fixFeeUsd: surface Persistence's dedicated `feeBreakdown.fixFeeUsd` when
  // present. Today only deBridge populates it — it's the fixed DLN solver fee
  // paid in the source chain's native token on top of the swap. Reading the
  // explicit field (not `protocolFeeUsd`, which also includes operating
  // expense) matches the label we show the user.
  const fixFeeUsd = quote.feeBreakdown?.fixFeeUsd;

  // integratorFeeUsd: BridgeKitty's own take, routed through Persistence's
  // integrator-fee plumbing. Today it's `0` on every provider (Persistence
  // isn't configured to charge an integrator fee for us yet). When that
  // changes, this field auto-populates and the frontend switches the
  // "BridgeKitty fee" row from "Free" to the actual USD amount — no code
  // changes needed on either side.
  const integratorFeeUsd = quote.feeBreakdown?.integratorFeeUsd;

  const tx = exec.transaction;

  return {
    id:         quote.quoteId,
    trackingId: exec.trackingId,
    routeSteps: [{ type: quote.route ?? quote.provider ?? quote.backendName }],
    feeUsd:     totalFeeUsd.toFixed(6),
    fixFeeUsd:  typeof fixFeeUsd === 'number' && fixFeeUsd > 0
      ? fixFeeUsd.toFixed(6)
      : undefined,
    integratorFeeUsd: typeof integratorFeeUsd === 'number' && integratorFeeUsd > 0
      ? integratorFeeUsd.toFixed(6)
      : undefined,
    duration:   { estimated: String(etaMs) },
    dstAmount,
    dstAmountMin,
    userSteps: tx
      ? [{
          type:        'TRANSACTION',
          action:      'Submit transaction from wallet.',
          transaction: {
            to:                    tx.to,
            data:                  tx.data,
            value:                 tx.value,
            gasLimit:              tx.gasLimit,
            gasPrice:              tx.gasPrice,
            maxFeePerGas:          tx.maxFeePerGas,
            maxPriorityFeePerGas:  tx.maxPriorityFeePerGas,
          }
        }]
      : [],
  };
}

interface ValidatedRequest {
  upstreamBody: UpstreamQuoteBody;
}

/** Pulls the request fields, validates them, and builds the upstream body.
 *  Returns either the parsed payload or a `{status, error}` to send back. */
function validateRequest(req: { body?: any }):
  | { ok: true; payload: ValidatedRequest }
  | { ok: false; status: number; error: string }
{
  const {
    srcChainKey,
    dstChainKey,
    srcTokenAddress,
    dstTokenAddress,
    amount,
    srcWalletAddress,
    dstWalletAddress,
  } = req.body ?? {};

  if (!srcTokenAddress || !dstTokenAddress || !amount) {
    return { ok: false, status: 400, error: 'Missing required fields: srcTokenAddress, dstTokenAddress, amount.' };
  }
  if (typeof amount !== 'string' || !/^\d+$/.test(amount)) {
    return { ok: false, status: 400, error: 'Amount must be a numeric string in smallest token units.' };
  }

  const fromChainId = resolveChainId(srcChainKey);
  const toChainId   = resolveChainId(dstChainKey);
  if (!fromChainId || !toChainId) {
    return { ok: false, status: 400, error: 'Invalid or unsupported chain key.' };
  }

  const fromAddress = srcWalletAddress;
  if (!fromAddress || fromAddress.toLowerCase() === ZERO_ADDRESS) {
    return { ok: false, status: 400, error: 'A connected wallet address is required to quote.' };
  }

  // Fund-safety guard: cross-wallet bridging not supported.
  if (dstWalletAddress && typeof dstWalletAddress === 'string') {
    const dst = dstWalletAddress.toLowerCase();
    if (dst === ZERO_ADDRESS) {
      return { ok: false, status: 400, error: 'Destination wallet address cannot be zero.' };
    }
    if (dst !== fromAddress.toLowerCase()) {
      return { ok: false, status: 400, error: 'Destination wallet must match the connected wallet. Cross-wallet bridging is not supported.' };
    }
  }

  return {
    ok: true,
    payload: {
      upstreamBody: {
        fromChainId,
        toChainId,
        fromTokenAddress: normalizeTokenAddress(srcTokenAddress),
        toTokenAddress:   normalizeTokenAddress(dstTokenAddress),
        amount,
        fromAddress,
        toAddress: dstWalletAddress ?? fromAddress,
      },
    },
  };
}

/**
 * Default route — returns quotes for every supported provider in one response.
 *
 * Flow per call:
 *   1 upstream `/quote` (shared across all 5 providers; no `providers` filter)
 *   N upstream `/execute`, where N = number of providers that have a route.
 *
 * Frontend gets a single payload it can splat into state — no race conditions,
 * no per-provider HTTP fan-out, no skeleton-then-disappear flicker for
 * providers that don't route the pair.
 */
router.post('/quotes', quoteLimiter, async (req, res) => {
  const v = validateRequest(req);
  if (!v.ok) return res.status(v.status).json({ error: v.error });
  const { upstreamBody } = v.payload;

  let upstream: UpstreamQuoteResponse;
  try {
    upstream = await getUpstreamQuotes(upstreamBody);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[quotes] upstream /quote failed:', msg);
    const status = error instanceof UpstreamError && error.status >= 400 && error.status < 500
      ? error.status
      : 502;
    return res.status(status).json({
      error: status >= 500 ? 'Quote service temporarily unavailable. Please try again.' : msg,
      detail: env.NODE_ENV === 'development' ? msg : undefined,
    });
  }

  // Run /execute for each provider concurrently. Each picks a different
  // `quoteId` from the shared upstream response, so there's no /execute 409
  // collision across providers within the same round.
  type RoundEntry =
    | { provider: SupportedProvider; pickedQuote: PersistenceQuote; exec: PersistenceExecuteResult }
    | { provider: SupportedProvider; error: string };

  const results: RoundEntry[] = await Promise.all(
    SUPPORTED_PROVIDERS.map(async (provider): Promise<RoundEntry> => {
      const picked = pickBestQuoteForProvider(upstream, provider);
      if ('error' in picked) {
        return { provider, error: picked.error.message };
      }
      try {
        const exec = await executeWithRecovery(picked.quote.quoteId);
        if (!exec.transaction?.to || !exec.transaction?.data) {
          return { provider, error: 'No executable transaction.' };
        }
        return { provider, pickedQuote: picked.quote, exec };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[quotes] ${provider} /execute failed:`, msg);
        return { provider, error: msg };
      }
    })
  );

  // ── Sanity filter: drop output-amount outliers ───────────────────────────
  //
  // What this guards against: Persistence sometimes forwards SAME-ASSET bridge
  // quotes (notably Across) for CROSS-ASSET swap requests. Across only bridges
  // identical assets across chains (ETH→ETH, USDC→USDC) — it doesn't swap.
  // When we ask Persistence for "ETH on Base → POL on Polygon", Across replies
  // with a quote that delivers 0.02 ETH-equivalent (as WETH on Polygon), but
  // Persistence labels it as the requested toToken (POL). The result is a
  // quote claiming "0.0199 POL" sitting next to legitimate "496 POL" routes —
  // and ranked as "best" because of its tiny implicit fee.
  //
  // How we detect it: compute every winner's output in human-readable units
  // (raw / 10^decimals), find the max, and drop anything below
  // OUTLIER_THRESHOLD × max.
  //
  // Threshold choice (1%):
  //   - The mislabel cases we've observed run at 0.001%–0.01% of the best
  //     output (orders of magnitude off), e.g. 0.02 POL vs 496 POL = 0.004%.
  //   - The worst plausible *legitimate* quote spread is bounded by
  //     fees + slippage. Fixed-fee providers (deBridge $2.32 DLN solver) on
  //     a tiny swap can shave ~50% in the worst case; bad slippage another
  //     20–30%. A real outlier above 10% of best simply doesn't happen.
  //   - 1% sits clearly between those ranges — catches every mislabel case
  //     we'd ever want to drop, with zero risk of clipping a legitimately
  //     bad-but-real route.
  //   - We require ≥2 successful quotes before applying the filter — with a
  //     single quote there's no reference, so we leave it alone (the user
  //     can still see it; if it's wrong they just don't click).
  const successes = results.filter(
    (r): r is Extract<RoundEntry, { pickedQuote: PersistenceQuote }> => 'pickedQuote' in r
  );
  const outlierProviders = new Set<string>();
  if (successes.length >= 2) {
    const outputs = successes.map((s) => {
      let raw = 0n;
      try { raw = BigInt(s.pickedQuote.outputAmountRaw ?? '0'); } catch { /* keep 0n */ }
      const dec = s.pickedQuote.outputDecimals ?? 18;
      return Number(raw) / Math.pow(10, dec);
    });
    const bestOutput = Math.max(...outputs);
    const OUTLIER_THRESHOLD = 0.01; // 1% of best
    if (bestOutput > 0) {
      successes.forEach((s, i) => {
        if (outputs[i] < bestOutput * OUTLIER_THRESHOLD) {
          outlierProviders.add(s.provider);
          console.warn(
            `[quotes] dropping ${s.provider}: output ${outputs[i]} is ${(outputs[i] / bestOutput * 100).toFixed(3)}% of best (${bestOutput}). Likely same-asset-bridge mislabel.`
          );
        }
      });
    }
  }

  const quotes: Record<string, unknown> = {};
  const failed: Record<string, string> = {};
  for (const r of results) {
    if ('pickedQuote' in r) {
      if (outlierProviders.has(r.provider)) {
        failed[r.provider] = 'no compatible route for this token pair';
      } else {
        quotes[r.provider] = buildQuoteResponse(r.pickedQuote, r.exec, r.provider);
      }
    } else {
      failed[r.provider] = r.error;
    }
  }

  return res.json({ quotes, failed });
});

export default router;
