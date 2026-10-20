import mongoose from 'mongoose';
import { env } from './env';

export async function connectDatabase(): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 8000,
    ...(env.dbName ? { dbName: env.dbName } : {}),
  });
  console.log(`[db] connected: ${mongoose.connection.name}`);
}
