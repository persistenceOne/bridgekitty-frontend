import { Router } from 'express';
import { z } from 'zod';
import { persistenceRequest } from '../lib/persistence.js';

const router = Router();

const walletSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address'),
});

router.post('/wallets', async (req, res) => {
  const parsed = walletSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid wallet address.' });
  }

  try {
    const result = await persistenceRequest({
      method: 'POST',
      path: '/wallets',
      body: { address: parsed.data.address.toLowerCase() },
    });

    if (!result.ok) {
      return res.status(result.status).json({
        error: 'Wallet registration failed.',
        detail: result.errorText,
      });
    }

    return res.status(200).json(result.data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Upstream unreachable.';
    return res.status(502).json({ error: msg });
  }
});

export default router;
