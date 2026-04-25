import { Router } from 'express';
import { persistenceRequest } from '../lib/persistence.js';

const router = Router();

/**
 * GET /chains — proxy to Persistence. Response is cached server-side on
 * Persistence for 10 minutes; we don't add another cache layer here.
 */
router.get('/chains', async (_req, res) => {
  try {
    const result = await persistenceRequest({ method: 'GET', path: '/chains' });

    if (!result.ok) {
      return res.status(result.status).json({
        error: 'Chain list unavailable.',
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
