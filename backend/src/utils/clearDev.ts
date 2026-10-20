/** Dev-only: wipe test dairies/entries/sessions. Leaves admins intact. */
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database';
import { Dairy } from '../models/Dairy';
import { MilkEntry } from '../models/MilkEntry';
import { Session } from '../models/Session';

(async () => {
  await connectDatabase();
  const r = await Promise.all([
    MilkEntry.deleteMany({}),
    Session.deleteMany({}),
    Dairy.deleteMany({}),
  ]);
  console.log('cleared entries/sessions/dairies:', r.map(x => x.deletedCount).join('/'));
  await mongoose.disconnect();
})();
