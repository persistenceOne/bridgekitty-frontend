import { Router } from 'express';
import { persistenceRequest } from '../lib/persistence.js';

const router = Router();

/**
 * GET /tokens?chainId=X — proxy to Persistence. Required query param.
 * Persistence caches per-chain lists for 10 minutes.
 */
router.get('/tokens', async (req, res) => {
  const chainIdRaw = req.query.chainId;
  const chainId = Number(chainIdRaw);

  if (!Number.isFinite(chainId) || chainId <= 0) {
    return res.status(400).json({ error: 'Missing or invalid query param: chainId.' });
  }

  try {
    const result = await persistenceRequest({
      method: 'GET',
      path: '/tokens',
      query: { chainId },
    });

    if (!result.ok) {
      return res.status(result.status).json({
        error: 'Token list unavailable.',
        detail: result.errorText,
      });
    }

    return res.json(result.data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Upstream unreachable.';
    return res.status(502).json({ error: msg });
  }
});

export default router;
