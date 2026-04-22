import { Router } from 'express';
import { TransactionHistory } from '../models/TransactionHistory.js';
import { isDatabaseReady } from '../config/db.js';

const router = Router();

function periodToDays(period: string): number | null {
  if (period === 'all') return null; // no date filter → lifetime
  if (period === '15d') return 15;
  if (period === '30d') return 30;
  return 7; // default 7d
}

router.get('/stats', async (req, res) => {
  if (!isDatabaseReady()) {
    return res.json({
      period: req.query.period ?? '7d',
      uniqueUsers: 0,
      swapVolumeUsd: 0,
      swapCount: 0,
    });
  }

  const period = typeof req.query.period === 'string' ? req.query.period : '7d';
  const days = periodToDays(period);
  const dateFilter = days != null
    ? { createdAt: { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) } }
    : {};

  const [swapStats, uniqueUsers] = await Promise.all([
    TransactionHistory.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalVolumeUsd: { $sum: { $ifNull: ['$volumeUsd', 0] } },
          count: { $sum: 1 },
        },
      },
    ]),
    TransactionHistory.distinct('userAddress', dateFilter),
  ]);

  const swapVolumeUsd = swapStats[0]?.totalVolumeUsd ?? 0;
  const swapCount = swapStats[0]?.count ?? 0;

  return res.json({
    period,
    uniqueUsers: uniqueUsers.length,
    swapVolumeUsd: Math.round(swapVolumeUsd * 100) / 100,
    swapCount,
  });
});

export default router;
