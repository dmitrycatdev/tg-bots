import { Router, Request, Response } from 'express';
import express from 'express';
import { prisma } from '../lib/prisma';
import { botManager } from '../services/botManager';

export const webhookRouter = Router();

// Raw body is needed for Telegraf to process webhook
webhookRouter.use(express.json());

/**
 * POST /api/webhook/:botId — endpoint для Telegram webhook
 */
webhookRouter.post('/:botId', async (req: Request, res: Response) => {
  try {
    const botId = req.params.botId as string;

    // Find bot in DB
    const bot = await prisma.bot.findUnique({
      where: { id: botId },
    });

    if (!bot || !bot.isActive) {
      res.status(404).json({ message: 'Bot not found' });
      return;
    }

    // Verify secret token from Telegram
    const secretToken = req.headers['x-telegram-bot-api-secret-token'];
    if (secretToken !== bot.webhookSecret) {
      res.status(403).json({ message: 'Invalid secret token' });
      return;
    }

    // Get or create Telegraf instance
    const telegraf = botManager.getOrCreate(bot.id, bot.token);

    // Process the update via Telegraf
    await telegraf.handleUpdate(req.body, res);
  } catch (error) {
    console.error('Webhook error:', error);
    // Always return 200 to Telegram to prevent retries
    res.status(200).json({ ok: true });
  }
});
