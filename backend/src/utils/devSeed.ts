/**
 * Dev-only: seed a dairy with N days of entries and print a session token.
 * Not wired into any route.  npx ts-node --transpile-only src/utils/devSeed.ts
 */
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database';
import { Dairy } from '../models/Dairy';
import { MilkEntry } from '../models/MilkEntry';
import { Session } from '../models/Session';
import { hashToken, newSessionToken } from '../middleware/authenticate';
import { calculateAmount } from './calculateAmount';
import { parseEntryDate } from './dates';

const DAYS = Number(process.argv[2] ?? 30);

(async () => {
  await connectDatabase();
  const mobile = '9' + String(Math.floor(Math.random() * 900000000) + 100000000);
  const dairy = await Dairy.create({
    ownerName: 'Bulk Owner',
    mobile,
    dairyName: 'Bulk Test Dairy',
    rateSettings: {
      buffalo: { rateMode: 'perFatPoint', rate: 9 },
      cow: { rateMode: 'perLitre', rate: 60 },
    },
  });

  const raw = newSessionToken();
  await Session.create({
    dairyId: dairy._id,
    tokenHash: hashToken(raw),
    deviceId: 'device-devseed01',
    expiresAt: new Date(Date.now() + 86400000),
  });

  const rows: any[] = [];
  for (let d = 0; d < DAYS; d++) {
    const date = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
    const entryDate = parseEntryDate(date);
    rows.push({
      dairyId: dairy._id, entryDate, shift: 'morning', milkType: 'buffalo',
      quantityLitres: 8.5, fatPercentage: 5.5, rateMode: 'perFatPoint', appliedRate: 9,
      totalAmount: calculateAmount({ quantityLitres: 8.5, fatPercentage: 5.5, rateMode: 'perFatPoint', appliedRate: 9 }),
    });
    rows.push({
      dairyId: dairy._id, entryDate, shift: 'evening', milkType: 'cow',
      quantityLitres: 7, fatPercentage: 4, rateMode: 'perLitre', appliedRate: 60,
      totalAmount: calculateAmount({ quantityLitres: 7, fatPercentage: 4, rateMode: 'perLitre', appliedRate: 60 }),
    });
  }
  await MilkEntry.insertMany(rows);
  await mongoose.disconnect();

  const from = new Date(Date.now() - (DAYS - 1) * 86400000).toISOString().slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);
  console.log(JSON.stringify({ token: raw, mobile, entries: rows.length, from, to }));
})();
