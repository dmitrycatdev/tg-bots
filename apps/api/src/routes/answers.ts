import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { NotFoundError, ForbiddenError } from '../lib/errors';
import { BlockType, AnswerType, RespondentStatus } from '@tg-bots/shared';

export const answersRouter = Router();

answersRouter.use(authMiddleware);

/**
 * Helper: check bot ownership
 */
async function getBotOrThrow(botId: string, userId: string) {
  const bot = await prisma.bot.findUnique({ where: { id: botId } });
  if (!bot) throw new NotFoundError('Бот не найден');
  if (bot.userId !== userId) throw new ForbiddenError();
  return bot;
}

/**
 * GET /api/bots/:id/answers — table of respondent answers
 */
answersRouter.get('/:id/answers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const botId = req.params.id as string;
    await getBotOrThrow(botId, req.userId!);

    // Get question blocks for columns
    const blocks = await prisma.block.findMany({
      where: { botId, type: BlockType.QUESTION },
      orderBy: { sortOrder: 'asc' },
    });

    // Get all respondents with their answers
    const respondents = await prisma.respondent.findMany({
      where: { botId },
      include: {
        answers: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Build rows
    const rows = respondents.map((r) => {
      const answers: Record<string, string> = {};
      for (const answer of r.answers) {
        answers[answer.blockId] = answer.value;
      }

      return {
        respondentId: r.id,
        chatId: r.chatId.toString(),
        username: r.username,
        firstName: r.firstName,
        lastName: r.lastName,
        status: r.status,
        answers,
        completedAt: r.status === RespondentStatus.COMPLETED ? r.updatedAt.toISOString() : null,
      };
    });

    res.json({
      data: {
        columns: blocks.map((b) => ({ id: b.id, text: b.text, answerType: b.answerType })),
        rows,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/bots/:id/answers/export — CSV export
 */
answersRouter.get('/:id/answers/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const botId = req.params.id as string;
    await getBotOrThrow(botId, req.userId!);

    // Get question blocks for headers
    const blocks = await prisma.block.findMany({
      where: { botId, type: BlockType.QUESTION },
      orderBy: { sortOrder: 'asc' },
    });

    // Get all respondents with answers
    const respondents = await prisma.respondent.findMany({
      where: { botId },
      include: { answers: true },
      orderBy: { createdAt: 'asc' },
    });

    // Build CSV
    const headers = [
      'Chat ID',
      'Username',
      'Имя',
      'Фамилия',
      'Статус',
      ...blocks.map((b) => b.text),
      'Дата завершения',
    ];

    const escCsv = (val: string) => {
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    const formatCsvValue = (value: string, answerType: string | null): string => {
      if (answerType === AnswerType.MULTI_CHOICE) {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) return parsed.join(', ');
        } catch { /* not JSON, return as-is */ }
      }
      return value;
    };

    const rows = respondents.map((r) => {
      const answerMap: Record<string, string> = {};
      for (const a of r.answers) {
        answerMap[a.blockId] = a.value;
      }

      return [
        r.chatId.toString(),
        r.username || '',
        r.firstName || '',
        r.lastName || '',
        r.status,
        ...blocks.map((b) => {
          const raw = answerMap[b.id] || '';
          return raw ? formatCsvValue(raw, b.answerType) : '';
        }),
        r.status === RespondentStatus.COMPLETED ? r.updatedAt.toISOString() : '',
      ]
        .map(escCsv)
        .join(',');
    });

    // BOM for Excel UTF-8 compatibility
    const bom = '\uFEFF';
    const csv = bom + headers.map(escCsv).join(',') + '\n' + rows.join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="answers-${botId}.csv"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
});
