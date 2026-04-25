import { Router } from 'express';
import { persistenceRequest } from '../lib/persistence.js';

const router = Router();

/**
 * GET /health — reports backend liveness and whether the upstream Persistence
 * API is currently reachable. `upstream: "disconnected"` is non-fatal; the
 * backend is still up but routing requests will fail with 502 until it recovers.
 */
router.get('/health', async (_req, res) => {
  let upstream: 'connected' | 'disconnected' = 'disconnected';
  try {
    const result = await persistenceRequest({ method: 'GET', path: '/health' });
    if (result.ok) upstream = 'connected';
  } catch {
    // leave disconnected
  }

  res.json({
    ok: true,
    service: 'bridgekitty-api',
    upstream,
  });
});

export default router;
