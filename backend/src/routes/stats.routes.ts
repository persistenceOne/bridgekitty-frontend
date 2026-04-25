import { Router } from 'express';
import { persistenceRequest } from '../lib/persistence.js';

const router = Router();

const VALID_PERIODS = new Set(['7d', '15d', '30d', 'all']);

router.get('/stats', async (req, res) => {
  const periodRaw = typeof req.query.period === 'string' ? req.query.period : '7d';
  const period = VALID_PERIODS.has(periodRaw) ? periodRaw : '7d';

  try {
    const result = await persistenceRequest<{
      period: string;
      uniqueUsers: number;
      swapVolumeUsd: number;
      swapCount: number;
    }>({
      method: 'GET',
      path: '/stats',
      query: { period },
    });

    if (!result.ok || !result.data) {
      // Fail soft — landing/stats views render zeros when the upstream is down
      // rather than throwing a surface error that breaks the page.
      return res.json({
        period,
        uniqueUsers: 0,
        swapVolumeUsd: 0,
        swapCount: 0,
      });
    }

    return res.json(result.data);
  } catch {
    return res.json({
      period,
      uniqueUsers: 0,
      swapVolumeUsd: 0,
      swapCount: 0,
    });
  }
});

export default router;
