import { Telegraf } from 'telegraf';
import { prisma } from '../lib/prisma';
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
    const bot = bots.get(botId);
    if (bot) {
      bot.stop();
      bots.delete(botId);
    }
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
    }

    console.log(`Loaded ${activeBots.length} active bots`);
  },
};
