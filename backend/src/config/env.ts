import dotenv from 'dotenv';
dotenv.config();

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  mongoUri: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/vtgmilksetu',
  // Set when the URI carries no database path (common with Atlas strings that
  // end at the host). Passed to Mongoose as dbName.
  dbName: process.env.DB_NAME?.trim() || undefined,
  jwtSecret: required('JWT_SECRET'),
  sessionTtlDays: Number(process.env.SESSION_TTL_DAYS ?? 180),
  adminTokenTtlHours: Number(process.env.ADMIN_TOKEN_TTL_HOURS ?? 12),
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
  // Serve the built admin panel from this same process. Defaults to on in
  // production (one service, one URL) and off in development, where the
  // panel runs its own dev server for fast refresh.
  serveAdmin:
    (process.env.SERVE_ADMIN ?? (process.env.NODE_ENV === 'production' ? 'true' : 'false')) ===
    'true',
};
