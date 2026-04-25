import { Router } from 'express';
import { z } from 'zod';
import { persistenceRequest } from '../lib/persistence.js';

const router = Router();

const TX_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;
const WALLET_REGEX = /^0x[a-fA-F0-9]{40}$/;

const createTransactionSchema = z.object({
  userAddress: z.string().regex(WALLET_REGEX),
  txHash: z.string().regex(TX_HASH_REGEX),
  quoteId: z.string().min(2).optional(),
  provider: z.string().min(2).optional(),
  fromChain: z.string().min(1),
  toChain: z.string().min(1),
  fromTokenSymbol: z.string().min(1),
  toTokenSymbol: z.string().min(1),
  amount: z.string().min(1),
  volumeUsd: z.number().nonnegative().optional(),
  status: z.string().optional(),
  metadata: z.unknown().optional(),
});

router.post('/transactions', async (req, res) => {
  const parsed = createTransactionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid transaction payload.' });
  }

  const payload = parsed.data;
  const body = {
    ...payload,
    userAddress: payload.userAddress.toLowerCase(),
    txHash: payload.txHash.toLowerCase(),
    status: payload.status ?? 'submitted',
  };

  try {
    const result = await persistenceRequest({ method: 'POST', path: '/transactions', body });

    if (!result.ok) {
      return res.status(result.status).json({
        error: 'Transaction record failed.',
        detail: result.errorText,
      });
    }

    return res.status(201).json(result.data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Upstream unreachable.';
    return res.status(502).json({ error: msg });
  }
});

router.get('/transactions', async (req, res) => {
  const userAddress = typeof req.query.userAddress === 'string'
    ? req.query.userAddress.toLowerCase()
    : undefined;
  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);

  try {
    const result = await persistenceRequest({
      method: 'GET',
      path: '/transactions',
      query: { userAddress, limit },
    });

    if (!result.ok) {
      return res.status(result.status).json({
        error: 'Transaction lookup failed.',
        detail: result.errorText,
      });
    }

    return res.json(result.data ?? { count: 0, records: [] });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Upstream unreachable.';
    return res.status(502).json({ error: msg });
  }
});

export default router;
