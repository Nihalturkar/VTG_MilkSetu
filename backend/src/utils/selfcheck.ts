/**
 * Runnable self-check for the money + date logic.
 *   npx ts-node --transpile-only src/utils/selfcheck.ts
 */
import assert from 'node:assert/strict';
import { calculateAmount } from './calculateAmount';
import { round2 } from './domain';
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

console.log('selfcheck: all assertions passed');
