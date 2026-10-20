/**
 * Create or reset the first admin from env vars:
 *   SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... npm run seed:admin
 * There is deliberately no public admin-registration endpoint.
 */
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database';
import { Admin } from '../models/Admin';

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in backend/.env first');
  }
  if (password.length < 10) {
    throw new Error('SEED_ADMIN_PASSWORD must be at least 10 characters');
  }

  await connectDatabase();
  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await Admin.findOne({ email });
  if (existing) {
    existing.passwordHash = passwordHash;
    existing.status = 'active';
    await existing.save();
    console.log(`[seed] password reset for existing admin: ${email}`);
  } else {
    await Admin.create({ email, passwordHash });
    console.log(`[seed] admin created: ${email}`);
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('[seed]', err.message);
  process.exit(1);
});
