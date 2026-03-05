import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  baseUrl: process.env.BASE_URL || 'http://localhost:4000',

  // JWT
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'access-secret-dev',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'refresh-secret-dev',
  jwtAccessExpiresIn: '15m',
  jwtRefreshExpiresIn: '7d',
  jwtRefreshExpiresInSeconds: 7 * 24 * 60 * 60, // 7 days

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/tgbots?schema=public',
};
