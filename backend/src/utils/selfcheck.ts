/**
 * Runnable self-check for the money + date logic.
 *   npx ts-node --transpile-only src/utils/selfcheck.ts
 */
import assert from 'node:assert/strict';
import { calculateAmount } from './calculateAmount';
import { round2, milestoneProgress, randomReferralCode, REFERRAL_CODE_RE } from './domain';
import { parseEntryDate, formatEntryDate, todayIST } from './dates';

// Spec examples.
assert.equal(
  calculateAmount({ quantityLitres: 10, fatPercentage: 5, rateMode: 'perLitre', appliedRate: 60 }),
  600,
  'perLitre: 10L x Rs60 = 600 (fat must be ignored)',
);
assert.equal(
  calculateAmount({ quantityLitres: 10, fatPercentage: 5, rateMode: 'perFatPoint', appliedRate: 9 }),
  450,
  'perFatPoint: 10L x 5 fat x Rs9 = 450',
);

// The two modes must not be interchangeable.
assert.notEqual(
  calculateAmount({ quantityLitres: 10, fatPercentage: 5, rateMode: 'perLitre', appliedRate: 9 }),
  calculateAmount({ quantityLitres: 10, fatPercentage: 5, rateMode: 'perFatPoint', appliedRate: 9 }),
  'Rs/litre must never equal Rs/fat-point for the same rate',
);

// Fractional values round to paise, not float noise.
assert.equal(
  calculateAmount({ quantityLitres: 8.5, fatPercentage: 5.5, rateMode: 'perFatPoint', appliedRate: 9.25 }),
  432.44,
  '8.5 x 5.5 x 9.25 = 432.4375 -> 432.44',
);
assert.equal(round2(1.005), 1.01, 'round2 must not drift below on .005');
assert.equal(
  calculateAmount({ quantityLitres: 0.5, fatPercentage: 3, rateMode: 'perLitre', appliedRate: 61 }),
  30.5,
  'fractional litres',
);

// Dates: round-trip and reject garbage.
assert.equal(formatEntryDate(parseEntryDate('2026-10-14')), '2026-10-14');
assert.equal(parseEntryDate('2026-10-14').getUTCHours(), 0, 'entry dates are UTC midnight');
assert.throws(() => parseEntryDate('2026-02-31'), 'rejects non-existent day');
assert.throws(() => parseEntryDate('14-10-2026'), 'rejects wrong format');

// 23:00 UTC is already the next calendar day in India.
assert.equal(todayIST(new Date('2026-10-14T23:00:00Z')), '2026-10-15', 'IST day rolls over before UTC');
assert.equal(todayIST(new Date('2026-10-14T10:00:00Z')), '2026-10-14');

// --- Referrals ----------------------------------------------------------

// Generated codes must always satisfy the regex the API validates against,
// otherwise a dairy gets a code it can never share successfully.
for (let i = 0; i < 500; i += 1) {
  const code = randomReferralCode();
  assert.match(code, REFERRAL_CODE_RE, `generated code ${code} must pass validation`);
}
assert.ok(!/[01OI]/.test(randomReferralCode().repeat(1)), 'alphabet excludes lookalike characters');

const MS = [
  { id: 'gold', referrals: 10, reward: '₹500' },
  { id: 'bronze', referrals: 3, reward: '₹100', rewardAmount: 100 },
  { id: 'silver', referrals: 5, reward: '₹250' },
];

// Ascending by referrals regardless of the order the admin saved them in.
assert.deepEqual(
  milestoneProgress(MS, 0, []).map(m => m.id),
  ['bronze', 'silver', 'gold'],
  'milestones sort ascending by referral count',
);

const at5 = milestoneProgress(MS, 5, ['bronze']);
assert.equal(at5[0].reached, true, '5 referrals clears the 3-referral tier');
assert.equal(at5[0].claimed, true, 'bronze already paid out');
assert.equal(at5[1].reached, true, 'boundary: count == referrals counts as reached');
assert.equal(at5[1].claimed, false, 'silver earned but not yet paid');
assert.equal(at5[2].reached, false, '5 referrals does not clear the 10-referral tier');
assert.equal(at5[2].remaining, 5, '5 more needed for gold');
assert.equal(at5[1].remaining, 0, 'remaining floors at 0, never negative');

// A reached-but-unclaimed tier is the payout queue; it must not collapse into
// "claimed" just because the count is high.
assert.equal(
  milestoneProgress(MS, 99, []).every(m => m.reached && !m.claimed),
  true,
  'high count reaches every tier but claims none',
);
assert.deepEqual(milestoneProgress([], 7, []), [], 'no milestones configured is not an error');
assert.equal(milestoneProgress(MS, 4, [])[0].rewardAmount, 100, 'rewardAmount passes through');
assert.equal(milestoneProgress(MS, 4, [])[1].rewardAmount, 0, 'rewardAmount defaults to 0');

console.log('selfcheck: all assertions passed');
