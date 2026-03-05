import { Telegraf } from 'telegraf';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import { handleUpdate, handleCallbackQuery } from './webhookHandler';

/** Хранилище экземпляров Telegraf по botId */
const bots = new Map<string, Telegraf>();

/**
 * Менеджер Telegram-ботов
 */
export const botManager = {
  /**
   * Получить или создать экземпляр Telegraf для бота
   */
  getOrCreate(botId: string, token: string): Telegraf {
    let bot = bots.get(botId);
    if (!bot) {
      bot = new Telegraf(token);
      bot.on('message', (ctx) => handleUpdate(botId, ctx));
      bot.on('callback_query', (ctx) => handleCallbackQuery(botId, ctx));
      bots.set(botId, bot);
    }
    return bot;
  },

  /**
   * Получить экземпляр Telegraf
   */
  get(botId: string): Telegraf | undefined {
    return bots.get(botId);
  },

  /**
   * Удалить экземпляр Telegraf
   */
  remove(botId: string) {
    bots.delete(botId);
  },

  /**
   * Загрузить все активные боты при старте сервера
   */
  async loadActiveBots() {
    const activeBots = await prisma.bot.findMany({
      where: { isActive: true },
    });

    for (const dbBot of activeBots) {
      this.getOrCreate(dbBot.id, dbBot.token);

      const webhookUrl = `${config.baseUrl}/api/webhook/${dbBot.id}`;
      try {
        const telegraf = new Telegraf(dbBot.token);
        await telegraf.telegram.setWebhook(webhookUrl, {
          secret_token: dbBot.webhookSecret,
        });
      } catch (error) {
        console.error(`Failed to set webhook for bot ${dbBot.id}:`, error);
      }
    }

    console.log(`Loaded ${activeBots.length} active bots`);
  },
};
