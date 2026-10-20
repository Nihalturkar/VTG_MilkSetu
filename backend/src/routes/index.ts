import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, requireAdmin } from '../middleware/authenticate';
import { validate } from '../middleware/validateRequest';
import * as auth from '../controllers/auth.controller';
import * as milk from '../controllers/milk.controller';
import * as rates from '../controllers/rates.controller';
import * as dashboard from '../controllers/dashboard.controller';
import * as reports from '../controllers/reports.controller';
import * as admin from '../controllers/admin.controller';

const router = Router();

// Throttle the unauthenticated, identity-adjacent endpoints.
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: { code: 'rate_limited', message: 'बहुत ज़्यादा कोशिशें। बाद में प्रयास करें।' } },
});

router.get('/health', (_req, res) => res.json({ ok: true, data: { status: 'up' } }));

// --- Dairy (mobile) -----------------------------------------------------
router.post('/register', strictLimiter, validate('body', auth.registerSchema), auth.register);
router.post('/session', strictLimiter, validate('body', auth.sessionSchema), auth.createSession);
router.get('/me', authenticate, auth.me);

router.get('/dashboard', authenticate, dashboard.getDashboard);

router.post('/milk', authenticate, validate('body', milk.createMilkSchema), milk.createMilkEntry);
router.get('/milk', authenticate, validate('query', milk.listMilkSchema), milk.listMilkEntries);

router.get('/rates', authenticate, rates.getRates);
router.put('/rates', authenticate, validate('body', rates.updateRatesSchema), rates.updateRates);

router.get('/reports', authenticate, validate('query', reports.reportSchema), reports.getReport);
router.get('/reports/pdf', authenticate, validate('query', reports.reportSchema), reports.getReportPdf);

// --- Admin --------------------------------------------------------------
router.post('/admin/login', strictLimiter, validate('body', admin.adminLoginSchema), admin.adminLogin);
router.get('/admin/dashboard', requireAdmin, admin.adminDashboard);
router.get('/admin/dairies', requireAdmin, validate('query', admin.adminListSchema), admin.adminDairies);
router.get('/admin/milk', requireAdmin, validate('query', admin.adminMilkSchema), admin.adminMilk);

export default router;
