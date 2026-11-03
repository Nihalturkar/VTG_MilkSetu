import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, requireAdmin } from '../middleware/authenticate';
import { validate } from '../middleware/validateRequest';
import * as auth from '../controllers/auth.controller';
import * as milk from '../controllers/milk.controller';
import * as rates from '../controllers/rates.controller';
import * as dashboard from '../controllers/dashboard.controller';
import * as reports from '../controllers/reports.controller';
import * as expenses from '../controllers/expense.controller';
import * as images from '../controllers/images.controller';
import * as notice from '../controllers/notice.controller';
import * as referral from '../controllers/referral.controller';
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

router.post('/expenses', authenticate, validate('body', expenses.createExpenseSchema), expenses.createExpense);
router.get('/expenses', authenticate, validate('query', expenses.listExpenseSchema), expenses.listExpenses);
router.get('/profit', authenticate, validate('query', expenses.profitSchema), expenses.getProfit);

router.get('/referrals', authenticate, referral.getMyReferrals);
router.post('/referrals/apply', authenticate, validate('body', referral.applyCodeSchema), referral.applyReferralCode);

router.get('/reports', authenticate, validate('query', reports.reportSchema), reports.getReport);
router.get('/reports/pdf', authenticate, validate('query', reports.reportSchema), reports.getReportPdf);

router.get('/notice', authenticate, notice.getTodayNotice);

// --- App artwork --------------------------------------------------------
// Public reads: the app needs these before it has a session. Writes are
// admin-only and take the raw file, so they bypass the JSON body parser.
router.get('/images', images.listImages);
router.get('/images/:key', validate('params', images.imageKeySchema), images.getImage);
// The raw body parser for this route is mounted in app.ts, ahead of
// express.json; here it is already a Buffer.
router.put('/images/:key', requireAdmin, validate('params', images.imageKeySchema), images.putImage);
router.delete('/images/:key', requireAdmin, validate('params', images.imageKeySchema), images.deleteImage);

// --- Admin --------------------------------------------------------------
router.post('/admin/login', strictLimiter, validate('body', admin.adminLoginSchema), admin.adminLogin);
router.get('/admin/dashboard', requireAdmin, admin.adminDashboard);
router.get('/admin/notice', requireAdmin, notice.getNoticeSettings);
router.put('/admin/notice', requireAdmin, validate('body', notice.updateNoticeSchema), notice.updateNoticeSettings);
router.get('/admin/dairies', requireAdmin, validate('query', admin.adminListSchema), admin.adminDairies);
router.get('/admin/milk', requireAdmin, validate('query', admin.adminMilkSchema), admin.adminMilk);

router.get('/admin/referrals/settings', requireAdmin, referral.adminGetSetting);
router.put('/admin/referrals/settings', requireAdmin, validate('body', referral.updateSettingSchema), referral.adminUpdateSetting);
router.get('/admin/referrals', requireAdmin, validate('query', referral.adminLeaderboardSchema), referral.adminLeaderboard);
router.post('/admin/referrals/reward', requireAdmin, validate('body', referral.adminMarkRewardSchema), referral.adminMarkReward);

export default router;
