import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { config } from '../config';
import { ConflictError, UnauthorizedError } from '../lib/errors';
import { ERROR_MESSAGES } from '@tg-bots/shared';
import type { AuthPayload } from '../middleware/auth';

/**
 * Генерация пары JWT-токенов (access + refresh)
 */
function generateTokens(userId: string) {
  const accessToken = jwt.sign(
    { userId } as AuthPayload,
    config.jwtAccessSecret,
    { expiresIn: config.jwtAccessExpiresIn } as jwt.SignOptions,
  );

  const refreshToken = uuidv4();

  return { accessToken, refreshToken };
}

/**
 * Сохранение refresh-токена в Redis
 */
async function saveRefreshToken(userId: string, refreshToken: string) {
  const key = `refresh:${refreshToken}`;
  await redis.set(key, userId, 'EX', config.jwtRefreshExpiresInSeconds);
}

/**
 * Регистрация нового пользователя
 */
export async function register(email: string, password: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ConflictError(ERROR_MESSAGES.EMAIL_ALREADY_EXISTS);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, passwordHash },
  });

  const tokens = generateTokens(user.id);
  await saveRefreshToken(user.id, tokens.refreshToken);

  return {
    user: { id: user.id, email: user.email, createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString() },
    tokens,
  };
}

/**
 * Вход в систему
 */
export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new UnauthorizedError(ERROR_MESSAGES.INVALID_CREDENTIALS);
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new UnauthorizedError(ERROR_MESSAGES.INVALID_CREDENTIALS);
  }

  const tokens = generateTokens(user.id);
  await saveRefreshToken(user.id, tokens.refreshToken);

  return {
    user: { id: user.id, email: user.email, createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString() },
    tokens,
  };
}

/**
 * Обновление access-токена через refresh-токен
 */
export async function refresh(refreshToken: string) {
  const key = `refresh:${refreshToken}`;
  const userId = await redis.get(key);

  if (!userId) {
    throw new UnauthorizedError('Невалидный refresh-токен');
  }

  // Remove old refresh token
  await redis.del(key);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new UnauthorizedError('Пользователь не найден');
  }

  const tokens = generateTokens(user.id);
  await saveRefreshToken(user.id, tokens.refreshToken);

  return {
    user: { id: user.id, email: user.email, createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString() },
    tokens,
  };
}

/**
 * Выход из системы (инвалидация refresh-токена)
 */
export async function logout(refreshToken: string) {
  const key = `refresh:${refreshToken}`;
  await redis.del(key);
}
