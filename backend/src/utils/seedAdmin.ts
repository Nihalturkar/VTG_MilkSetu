/**
 * Create or reset the first admin from env vars:
 *   SEED_ADMIN_USERNAME=... SEED_ADMIN_PASSWORD=... npm run seed:admin
 * There is deliberately no public admin-registration endpoint.
 */
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database';
import { Admin } from '../models/Admin';

async function main() {
  // SEED_ADMIN_EMAIL is still read so an existing .env keeps working; the
  // local part before "@" becomes the username.
  const raw =
    process.env.SEED_ADMIN_USERNAME?.trim() ?? process.env.SEED_ADMIN_EMAIL?.trim().split('@')[0];
  const username = raw?.toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!username || !password) {
    throw new Error('Set SEED_ADMIN_USERNAME and SEED_ADMIN_PASSWORD in backend/.env first');
  }
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
    throw new Error('SEED_ADMIN_USERNAME must be 3-40 chars: letters, digits, . _ -');
  }
  if (password.length < 8) {
    throw new Error('SEED_ADMIN_PASSWORD must be at least 8 characters');
  }

  await connectDatabase();
  const passwordHash = await bcrypt.hash(password, 12);

  // Accounts created before the email -> username switch still carry an
  // `email` field and no `username`. Adopt the first such row rather than
  // leaving an unreachable admin behind and a stale unique index on email.
  const existing =
    (await Admin.findOne({ username })) ??
    (await Admin.findOne({ username: { $exists: false } }));

  if (existing) {
    const wasLegacy = !existing.username;
    existing.username = username;
    existing.passwordHash = passwordHash;
    existing.status = 'active';
    // Drop the old field so the legacy unique index has nothing to clash on.
    existing.set('email', undefined, { strict: false });
    await existing.save();
    console.log(
      wasLegacy
        ? `[seed] migrated legacy admin to username: ${username}`
        : `[seed] password reset for existing admin: ${username}`,
    );
  } else {
    await Admin.create({ username, passwordHash });
    console.log(`[seed] admin created: ${username}`);
  }

  // The old unique index on `email` would reject every later insert once the
  // field is gone from the schema, so retire it.
  const indexes = await Admin.collection.indexes().catch(() => []);
  if (indexes.some((i: { name?: string }) => i.name === 'email_1')) {
    await Admin.collection.dropIndex('email_1').catch(() => {});
    console.log('[seed] dropped stale email_1 index');
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('[seed]', err.message);
  process.exit(1);
});
