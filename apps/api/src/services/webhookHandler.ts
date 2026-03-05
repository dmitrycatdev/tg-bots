import { Context } from 'telegraf';
import { prisma } from '../lib/prisma';
import {
  BlockType,
  AnswerType,
  RespondentStatus,
  ERROR_MESSAGES,
  RATING_MIN,
  RATING_MAX,
} from '@tg-bots/shared';

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

const TELEGRAM_ALLOWED_TAGS = new Set([
  'b', 'strong', 'i', 'em', 'u', 'ins', 's', 'strike', 'del',
  'a', 'code', 'pre', 'tg-spoiler',
]);

function toTelegramHtml(value: string): string {
  if (!/<\/?[a-z][\s\S]*>/i.test(value)) {
    return escapeHtml(value);
  }

  let result = value;
  result = result.replace(/<br\s*\/?>/gi, '\n');
  result = result.replace(/<\/p>\s*<p[^>]*>/gi, '\n\n');
  result = result.replace(/<\/?p[^>]*>/gi, '');

  result = result.replace(/<\/?([a-z][a-z0-9-]*)[^>]*>/gi, (match, tag) => {
    return TELEGRAM_ALLOWED_TAGS.has(tag.toLowerCase()) ? match : '';
  });

  return result.trim();
}

/**
 * Отправка вопроса респонденту через контекст Telegraf
 */
async function sendQuestion(ctx: Context, block: {
  id: string;
  type: string;
  text: string;
  mediaUrl: string | null;
  answerType: string | null;
  options: unknown;
  buttonText: string | null;
}) {
  const text = toTelegramHtml(block.text);

  if (block.type === BlockType.START) {
    if (block.mediaUrl) {
      await ctx.replyWithPhoto(block.mediaUrl, {
        caption: text,
        parse_mode: 'HTML',
      });
    } else {
      await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: { remove_keyboard: true },
      });
    }
    return;
  }

  if (block.type === BlockType.MESSAGE) {
    if (block.mediaUrl) {
      await ctx.replyWithPhoto(block.mediaUrl, {
        caption: text,
        parse_mode: 'HTML',
      });
    } else {
      await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: { remove_keyboard: true },
      });
    }
    return;
  }

  if (block.type === BlockType.FINISH) {
    await ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: { remove_keyboard: true },
    });
    return;
  }

  // QUESTION block
  if (block.answerType === AnswerType.RATING) {
    const buttons = [];
    for (let i = RATING_MIN; i <= RATING_MAX; i++) {
      buttons.push({ text: String(i), callback_data: `rate:${i}` });
    }
    await ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [buttons],
      },
    });
  } else if (block.answerType === AnswerType.MULTI_CHOICE && Array.isArray(block.options)) {
    const optionRows = (block.options as string[]).map((opt, i) => [
      { text: opt, callback_data: `mc:${i}` },
    ]);
    const continueText = block.buttonText || 'Продолжить ▸';
    optionRows.push([{ text: continueText, callback_data: 'mc:done' }]);
    await ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: optionRows },
    });
  } else if (block.answerType === AnswerType.SINGLE_CHOICE && Array.isArray(block.options)) {
    const keyboard = (block.options as string[]).map((opt) => [{ text: opt }]);
    await ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: {
        keyboard,
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });
  } else {
    await ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: { remove_keyboard: true },
    });
  }
}

/**
 * Получение следующего блока после текущего
 */
async function getNextBlock(botId: string, currentSortOrder: number) {
  return prisma.block.findFirst({
    where: {
      botId,
      sortOrder: { gt: currentSortOrder },
    },
    orderBy: { sortOrder: 'asc' },
  });
}

/**
 * Отправка всех подряд идущих MESSAGE-блоков и возврат первого не-MESSAGE блока
 */
async function skipMessageBlocks(
  ctx: Context,
  botId: string,
  block: Awaited<ReturnType<typeof getNextBlock>>,
) {
  let current = block;
  while (current && current.type === BlockType.MESSAGE) {
    await sendQuestion(ctx, current);
    current = await getNextBlock(botId, current.sortOrder);
  }
  return current;
}

/**
 * Завершение опроса или переход к следующему блоку
 */
async function completeOrAdvance(
  ctx: Context,
  botId: string,
  respondentId: string,
  nextBlock: Awaited<ReturnType<typeof getNextBlock>>,
) {
  const actual = await skipMessageBlocks(ctx, botId, nextBlock);

  if (!actual || actual.type === BlockType.FINISH) {
    const finishBlock = actual || await prisma.block.findFirst({
      where: { botId, type: BlockType.FINISH },
    });

    await prisma.respondent.update({
      where: { id: respondentId },
      data: {
        currentBlockId: null,
        status: RespondentStatus.COMPLETED,
      },
    });

    if (finishBlock) {
      await sendQuestion(ctx, finishBlock);
    } else {
      await ctx.reply('Спасибо за участие в опросе!', {
        reply_markup: { remove_keyboard: true },
      });
    }
    return;
  }

  await prisma.respondent.update({
    where: { id: respondentId },
    data: { currentBlockId: actual.id },
  });

  await sendQuestion(ctx, actual);
}

/**
 * Основной обработчик входящих сообщений от Telegram
 */
export async function handleUpdate(botId: string, ctx: Context) {
  try {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const fromUser = ctx.from;

    // Find or create respondent
    let respondent = await prisma.respondent.findUnique({
      where: { botId_chatId: { botId, chatId: BigInt(chatId) } },
      include: { currentBlock: true },
    });

    // Check if this is a /start command
    const isStart =
      ctx.message && 'text' in ctx.message && ctx.message.text === '/start';

    if (isStart) {
      // Get the START block
      const startBlock = await prisma.block.findFirst({
        where: { botId, type: BlockType.START },
        orderBy: { sortOrder: 'asc' },
      });

      if (!startBlock) {
        await ctx.reply('Опрос ещё не настроен.');
        return;
      }

      await sendQuestion(ctx, startBlock);

      const firstBlock = await getNextBlock(botId, startBlock.sortOrder);
      if (!firstBlock) {
        await ctx.reply('В опросе нет вопросов.');
        return;
      }

      const firstInteractive = await skipMessageBlocks(ctx, botId, firstBlock);

      if (!firstInteractive || firstInteractive.type === BlockType.FINISH) {
        const finishBlock = firstInteractive || await prisma.block.findFirst({
          where: { botId, type: BlockType.FINISH },
        });

        const respondentData = {
          currentBlockId: null as string | null,
          status: RespondentStatus.COMPLETED,
          username: fromUser?.username || null,
          firstName: fromUser?.first_name || null,
          lastName: fromUser?.last_name || null,
        };

        if (respondent) {
          await prisma.answer.deleteMany({ where: { respondentId: respondent.id } });
          await prisma.respondent.update({ where: { id: respondent.id }, data: respondentData });
        } else {
          await prisma.respondent.create({
            data: { botId, chatId: BigInt(chatId), ...respondentData },
          });
        }

        if (finishBlock) {
          await sendQuestion(ctx, finishBlock);
        } else {
          await ctx.reply('Спасибо за участие в опросе!', { reply_markup: { remove_keyboard: true } });
        }
        return;
      }

      if (respondent) {
        await prisma.answer.deleteMany({
          where: { respondentId: respondent.id },
        });
        respondent = await prisma.respondent.update({
          where: { id: respondent.id },
          data: {
            currentBlockId: firstInteractive.id,
            status: RespondentStatus.IN_PROGRESS,
            username: fromUser?.username || null,
            firstName: fromUser?.first_name || null,
            lastName: fromUser?.last_name || null,
          },
          include: { currentBlock: true },
        });
      } else {
        respondent = await prisma.respondent.create({
          data: {
            botId,
            chatId: BigInt(chatId),
            username: fromUser?.username || null,
            firstName: fromUser?.first_name || null,
            lastName: fromUser?.last_name || null,
            currentBlockId: firstInteractive.id,
            status: RespondentStatus.IN_PROGRESS,
          },
          include: { currentBlock: true },
        });
      }

      await sendQuestion(ctx, firstInteractive);
      return;
    }

    // If no respondent exists, prompt to /start
    if (!respondent || !respondent.currentBlock) {
      await ctx.reply('Напишите /start, чтобы начать опрос.');
      return;
    }

    // If already completed, prompt to restart
    if (respondent.status === RespondentStatus.COMPLETED) {
      await ctx.reply('Вы уже прошли этот опрос. Напишите /start, чтобы начать заново.');
      return;
    }

    const currentBlock = respondent.currentBlock;

    // Handle answer for QUESTION block
    if (currentBlock.type === BlockType.QUESTION) {
      let answerValue: string | null = null;

      // Validate by answer type
      switch (currentBlock.answerType) {
        case AnswerType.TEXT: {
          const text = ctx.message && 'text' in ctx.message ? ctx.message.text : null;
          if (!text) {
            await ctx.reply('Пожалуйста, отправьте текстовое сообщение.');
            return;
          }
          answerValue = text;
          break;
        }

        case AnswerType.SINGLE_CHOICE: {
          const text = ctx.message && 'text' in ctx.message ? ctx.message.text : null;
          const options = Array.isArray(currentBlock.options)
            ? (currentBlock.options as string[])
            : [];
          if (!text || !options.includes(text)) {
            await ctx.reply(ERROR_MESSAGES.PLEASE_SELECT_OPTION);
            return;
          }
          answerValue = text;
          break;
        }

        case AnswerType.MULTI_CHOICE: {
          await ctx.reply('Пожалуйста, используйте кнопки для выбора вариантов.');
          return;
        }

        case AnswerType.RATING: {
          await ctx.reply(ERROR_MESSAGES.PLEASE_SELECT_RATING);
          return;
        }

        default:
          answerValue = ctx.message && 'text' in ctx.message ? ctx.message.text || '' : '';
      }

      if (answerValue === null) return;

      // Save answer
      await prisma.answer.create({
        data: {
          respondentId: respondent.id,
          blockId: currentBlock.id,
          value: answerValue,
        },
      });

      const nextBlock = await getNextBlock(botId, currentBlock.sortOrder);
      await completeOrAdvance(ctx, botId, respondent.id, nextBlock);
    }
  } catch (error) {
    console.error('Error handling webhook update:', error);
    try {
      await ctx.reply('Произошла ошибка. Попробуйте ещё раз или напишите /start.');
    } catch {
      // Ignore send errors
    }
  }
}

const MC_CHECK = '✓ ';

/**
 * Обработка нажатий на inline-кнопки (callback_query) — RATING и MULTI_CHOICE
 */
export async function handleCallbackQuery(botId: string, ctx: Context) {
  try {
    const callbackQuery = ctx.callbackQuery;
    if (!callbackQuery || !('data' in callbackQuery)) return;

    const chatId = callbackQuery.message?.chat.id;
    if (!chatId) return;

    const data = callbackQuery.data;

    if (data.startsWith('rate:')) {
      await handleRatingCallback(botId, ctx, chatId, data);
    } else if (data.startsWith('mc:')) {
      await handleMultiChoiceCallback(botId, ctx, chatId, data);
    } else {
      await ctx.answerCbQuery();
    }
  } catch (error) {
    console.error('Error handling callback query:', error);
    try {
      await ctx.answerCbQuery('Произошла ошибка');
    } catch {
      // Ignore errors
    }
  }
}

async function handleRatingCallback(botId: string, ctx: Context, chatId: number, data: string) {
  const ratingValue = Number(data.split(':')[1]);
  if (isNaN(ratingValue) || ratingValue < RATING_MIN || ratingValue > RATING_MAX) {
    await ctx.answerCbQuery('Некорректная оценка');
    return;
  }

  const respondent = await prisma.respondent.findUnique({
    where: { botId_chatId: { botId, chatId: BigInt(chatId) } },
    include: { currentBlock: true },
  });

  if (!respondent?.currentBlock) {
    await ctx.answerCbQuery();
    return;
  }

  if (respondent.status === RespondentStatus.COMPLETED) {
    await ctx.answerCbQuery('Опрос уже завершён');
    return;
  }

  const currentBlock = respondent.currentBlock;

  if (currentBlock.answerType !== AnswerType.RATING) {
    await ctx.answerCbQuery();
    return;
  }

  await prisma.answer.create({
    data: {
      respondentId: respondent.id,
      blockId: currentBlock.id,
      value: String(ratingValue),
    },
  });

  await ctx.editMessageText(
    `${toTelegramHtml(currentBlock.text)}<br><br>${escapeHtml(`Ваша оценка: ${ratingValue} ✓`)}`,
    { parse_mode: 'HTML' },
  );
  await ctx.answerCbQuery();

  const nextBlock = await getNextBlock(botId, currentBlock.sortOrder);
  await completeOrAdvance(ctx, botId, respondent.id, nextBlock);
}

async function handleMultiChoiceCallback(botId: string, ctx: Context, chatId: number, data: string) {
  const msg = ctx.callbackQuery?.message;
  if (!msg || !('reply_markup' in msg) || !msg.reply_markup) {
    await ctx.answerCbQuery();
    return;
  }

  const keyboard = msg.reply_markup.inline_keyboard;
  const action = data.slice(3); // strip "mc:"

  if (action === 'done') {
    const selected = keyboard
      .filter((row) => {
        const btn = row[0];
        return btn.text.startsWith(MC_CHECK) && ('callback_data' in btn) && btn.callback_data !== 'mc:done';
      })
      .map((row) => row[0].text.slice(MC_CHECK.length));

    const respondent = await prisma.respondent.findUnique({
      where: { botId_chatId: { botId, chatId: BigInt(chatId) } },
      include: { currentBlock: true },
    });

    if (!respondent?.currentBlock) {
      await ctx.answerCbQuery();
      return;
    }

    if (respondent.status === RespondentStatus.COMPLETED) {
      await ctx.answerCbQuery('Опрос уже завершён');
      return;
    }

    const currentBlock = respondent.currentBlock;

    await prisma.answer.create({
      data: {
        respondentId: respondent.id,
        blockId: currentBlock.id,
        value: JSON.stringify(selected),
      },
    });

    const summary = selected.length > 0
      ? `Выбрано: ${selected.join(', ')} ✓`
      : 'Ничего не выбрано';
    await ctx.editMessageText(
      `${toTelegramHtml(currentBlock.text)}<br><br>${escapeHtml(summary)}`,
      { parse_mode: 'HTML' },
    );
    await ctx.answerCbQuery();

    const nextBlock = await getNextBlock(botId, currentBlock.sortOrder);
    await completeOrAdvance(ctx, botId, respondent.id, nextBlock);
    return;
  }

  // Toggle option
  const index = Number(action);
  if (isNaN(index) || index < 0 || index >= keyboard.length - 1) {
    await ctx.answerCbQuery();
    return;
  }

  const btn = keyboard[index][0];
  if (btn.text.startsWith(MC_CHECK)) {
    btn.text = btn.text.slice(MC_CHECK.length);
  } else {
    btn.text = MC_CHECK + btn.text;
  }

  await ctx.editMessageReplyMarkup({ inline_keyboard: keyboard });
  await ctx.answerCbQuery();
}
