import { Router } from 'express';
import healthRoutes from './health.routes.js';
import quotesRoutes from './quotes.routes.js';
import swapsRoutes from './swaps.routes.js';
import transactionsRoutes from './transactions.routes.js';
import walletsRoutes from './wallets.routes.js';
import statusRoutes from './status.routes.js';
import statsRoutes from './stats.routes.js';
import chainsRoutes from './chains.routes.js';
import tokensRoutes from './tokens.routes.js';

const router = Router();

router.use('/', healthRoutes);
router.use('/', quotesRoutes);
router.use('/', swapsRoutes);
router.use('/', transactionsRoutes);
router.use('/', walletsRoutes);
router.use('/', statusRoutes);
router.use('/', statsRoutes);
router.use('/', chainsRoutes);
router.use('/', tokensRoutes);

export default router;
