import { Router, Request, Response, NextFunction } from 'express';
import { Telegraf } from 'telegraf';
import { v4 as uuidv4 } from 'uuid';
import { createBotSchema } from '@tg-bots/shared';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { BadRequestError, NotFoundError, ForbiddenError } from '../lib/errors';
import { config } from '../config';
import { botManager } from '../services/botManager';
import { ERROR_MESSAGES, BlockType } from '@tg-bots/shared';

export const botsRouter = Router();

// All routes require auth
botsRouter.use(authMiddleware);

/**
 * GET /api/bots — list user bots
 */
botsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bots = await prisma.bot.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        telegramBotId: true,
        telegramUsername: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { respondents: true, blocks: true } },
      },
    });
    res.json({ data: bots });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/bots/:id — bot details
 */
botsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const botId = req.params.id as string;
    const bot = await prisma.bot.findUnique({
      where: { id: botId },
      select: {
        id: true,
        userId: true,
        name: true,
        telegramBotId: true,
        telegramUsername: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { respondents: true, blocks: true } },
      },
    });

    if (!bot) throw new NotFoundError(ERROR_MESSAGES.BOT_NOT_FOUND);
    if (bot.userId !== req.userId) throw new ForbiddenError();

    res.json({ data: bot });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/bots — connect a new bot
 */
botsRouter.post(
  '/',
  validate(createBotSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, token } = req.body;

      // Validate token via Telegram getMe
      let telegramBotInfo;
      try {
        const telegraf = new Telegraf(token);
        telegramBotInfo = await telegraf.telegram.getMe();
      } catch {
        throw new BadRequestError(ERROR_MESSAGES.INVALID_TOKEN);
      }

      // Generate unique webhook secret
      const webhookSecret = uuidv4();

      // Create bot in DB
      const bot = await prisma.bot.create({
        data: {
          userId: req.userId!,
          name,
          token,
          telegramBotId: String(telegramBotInfo.id),
          telegramUsername: telegramBotInfo.username || '',
          webhookSecret,
          isActive: true,
        },
      });

      // Create default blocks: START + FINISH
      await prisma.block.createMany({
        data: [
          {
            botId: bot.id,
            type: BlockType.START,
            sortOrder: 0,
            text: 'Добро пожаловать! Этот бот проведёт для вас опрос.',
            buttonText: 'Начать',
            isRequired: true,
          },
          {
            botId: bot.id,
            type: BlockType.FINISH,
            sortOrder: 1000,
            text: 'Спасибо за участие в опросе!',
            isRequired: true,
          },
        ],
      });

      // Set webhook
      const webhookUrl = `${config.baseUrl}/api/webhook/${bot.id}`;
      try {
        const telegraf = new Telegraf(token);
        await telegraf.telegram.setWebhook(webhookUrl, {
          secret_token: webhookSecret,
        });
      } catch (error) {
        console.error('Failed to set webhook:', error);
      }

      // Register bot instance in memory
      botManager.getOrCreate(bot.id, token);

      res.status(201).json({
        data: {
          id: bot.id,
          name: bot.name,
          telegramBotId: bot.telegramBotId,
          telegramUsername: bot.telegramUsername,
          isActive: bot.isActive,
          createdAt: bot.createdAt,
          updatedAt: bot.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * DELETE /api/bots/:id — delete a bot
 */
botsRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const botId = req.params.id as string;
    const bot = await prisma.bot.findUnique({
      where: { id: botId },
    });

    if (!bot) throw new NotFoundError(ERROR_MESSAGES.BOT_NOT_FOUND);
    if (bot.userId !== req.userId) throw new ForbiddenError();

    // Remove webhook
    try {
      const telegraf = new Telegraf(bot.token);
      await telegraf.telegram.deleteWebhook();
    } catch {
      // Ignore errors on webhook deletion
    }

    // Remove bot instance from memory
    botManager.remove(bot.id);

    // Delete from DB (cascades)
    await prisma.bot.delete({ where: { id: bot.id } });

    res.json({ data: { success: true } });
  } catch (error) {
    next(error);
  }
});
