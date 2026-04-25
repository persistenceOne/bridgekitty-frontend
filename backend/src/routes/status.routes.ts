import { Router } from 'express';
import { env } from '../config/env.js';

const router = Router();

// Our stage names → Persistence state names → back to our stages
const STATE_TO_STAGE: Record<string, string> = {
  pending:     'confirming',
  in_progress: 'bridging',
  completed:   'completed',
  failed:      'failed',
  refunded:    'failed',   // refund = terminal failure from user's perspective
  unknown:     'confirming', // keep polling; Persistence says treat as transient
};

const CHAIN_ID_BY_KEY: Record<string, number> = {
  ethereum: 1,
  base:     8453,
  bsc:      56,
  polygon:  137,
  monad:    143,
};

// trackingId format: "<provider>:<hash-or-id>" — e.g. "lifi:0xabc...",
// "debridge:0xorderhash", "across:1:1777041280819". Strict allowlist of
// characters prevents path traversal or URL manipulation when we interpolate
// this into the Persistence status URL.
const TRACKING_ID_RE = /^[a-z]+:[a-z0-9:_-]+$/i;

router.get('/status', async (req, res) => {
  // `provider` now carries the full trackingId (e.g. "lifi:0xabc..." or "debridge:0xorderhash")
  // as set by the frontend after receiving the quote. txHash is kept for metadata.
  const trackingId = typeof req.query.provider === 'string' ? req.query.provider : undefined;
  const txHash     = typeof req.query.txHash  === 'string' ? req.query.txHash   : undefined;
  const fromChainKey = typeof req.query.fromChain === 'string' ? req.query.fromChain : undefined;

  if (!trackingId) {
    return res.status(400).json({ error: 'Missing required param: provider (trackingId).' });
  }

  if (!TRACKING_ID_RE.test(trackingId) || trackingId.length > 128) {
    return res.status(400).json({ error: 'Invalid trackingId format.' });
  }

  try {
    // Build Persistence status URL. The trackingId is used verbatim in the path
    // (e.g. /status/lifi:0xabc or /status/debridge:0xorderhash).
    // Extra query params are forwarded as hints for providers that need them.
    const url = new URL(`${env.PERSISTENCE_API_BASE_URL}/status/${trackingId}`);
    if (txHash) url.searchParams.set('txHash', txHash);
    if (fromChainKey && fromChainKey in CHAIN_ID_BY_KEY) {
      url.searchParams.set('fromChain', String(CHAIN_ID_BY_KEY[fromChainKey]));
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Persistence /status failed (${response.status}): ${text}`);
    }

    const data = (await response.json()) as {
      state?: string;
      humanReadable?: string;
      sourceTxHash?: string;
      destTxHash?: string;
      provider?: string;
      elapsed?: number;
      estimatedRemaining?: number;
    };

    const stage = STATE_TO_STAGE[data.state ?? 'unknown'] ?? 'confirming';

    return res.json({
      status: stage,
      substatus: data.humanReadable,
      sendingTxHash: data.sourceTxHash ?? txHash,
      receivingTxHash: data.destTxHash ?? undefined,
    });
  } catch (error) {
    return res.status(502).json({
      error: error instanceof Error ? error.message : 'Status check failed.',
      status: 'pending',
    });
  }
});

export default router;
