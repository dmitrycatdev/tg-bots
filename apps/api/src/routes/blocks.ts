import { Router, Request, Response, NextFunction } from 'express';
import { createBlockSchema, updateBlockSchema, reorderBlocksSchema, BlockType } from '@tg-bots/shared';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { NotFoundError, ForbiddenError, BadRequestError } from '../lib/errors';

export const blocksRouter = Router();

// All routes require auth
blocksRouter.use(authMiddleware);

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
 * GET /api/bots/:id/blocks — list scenario blocks
 */
blocksRouter.get('/:id/blocks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const botId = req.params.id as string;
    await getBotOrThrow(botId, req.userId!);

    const blocks = await prisma.block.findMany({
      where: { botId },
      orderBy: { sortOrder: 'asc' },
    });

    res.json({ data: blocks });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/bots/:id/blocks — add block
 */
blocksRouter.post(
  '/:id/blocks',
  validate(createBlockSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const botId = req.params.id as string;
      await getBotOrThrow(botId, req.userId!);

      const { type, text, mediaUrl, answerType, options, buttonText, isRequired } = req.body;

      // START and FINISH blocks: only one allowed
      if (type === BlockType.START || type === BlockType.FINISH) {
        const existing = await prisma.block.findFirst({
          where: { botId, type },
        });
        if (existing) {
          throw new BadRequestError(`Блок типа "${type}" уже существует`);
        }
      }

      // Get max sort order for this bot
      const lastBlock = await prisma.block.findFirst({
        where: { botId },
        orderBy: { sortOrder: 'desc' },
      });

      // Place new block before FINISH
      const finishBlock = await prisma.block.findFirst({
        where: { botId, type: BlockType.FINISH },
      });

      let sortOrder: number;
      if (type === BlockType.FINISH) {
        sortOrder = (lastBlock?.sortOrder ?? 0) + 100;
      } else if (finishBlock) {
        sortOrder = finishBlock.sortOrder - 1;
        if (sortOrder <= (lastBlock?.sortOrder ?? 0)) {
          await prisma.block.update({
            where: { id: finishBlock.id },
            data: { sortOrder: finishBlock.sortOrder + 100 },
          });
          sortOrder = finishBlock.sortOrder;
        }
      } else {
        sortOrder = (lastBlock?.sortOrder ?? 0) + 100;
      }

      const block = await prisma.block.create({
        data: {
          botId,
          type,
          sortOrder,
          text,
          mediaUrl: mediaUrl || null,
          answerType: answerType || null,
          options: options || null,
          buttonText: buttonText || null,
          isRequired: isRequired ?? true,
        },
      });

      res.status(201).json({ data: block });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * PUT /api/bots/:id/blocks/:blockId — update block
 */
blocksRouter.put(
  '/:id/blocks/:blockId',
  validate(updateBlockSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const botId = req.params.id as string;
      const blockId = req.params.blockId as string;
      await getBotOrThrow(botId, req.userId!);

      const block = await prisma.block.findUnique({
        where: { id: blockId },
      });

      if (!block || block.botId !== botId) {
        throw new NotFoundError('Блок не найден');
      }

      const { text, mediaUrl, answerType, options, buttonText, isRequired } = req.body;

      const updated = await prisma.block.update({
        where: { id: block.id },
        data: {
          ...(text !== undefined && { text }),
          ...(mediaUrl !== undefined && { mediaUrl }),
          ...(answerType !== undefined && { answerType }),
          ...(options !== undefined && { options }),
          ...(buttonText !== undefined && { buttonText }),
          ...(isRequired !== undefined && { isRequired }),
        },
      });

      res.json({ data: updated });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * DELETE /api/bots/:id/blocks/:blockId — delete block
 */
blocksRouter.delete(
  '/:id/blocks/:blockId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const botId = req.params.id as string;
      const blockId = req.params.blockId as string;
      await getBotOrThrow(botId, req.userId!);

      const block = await prisma.block.findUnique({
        where: { id: blockId },
      });

      if (!block || block.botId !== botId) {
        throw new NotFoundError('Блок не найден');
      }

      if (block.type === BlockType.START || block.type === BlockType.FINISH) {
        throw new BadRequestError('Нельзя удалить стартовый или финальный блок');
      }

      await prisma.block.delete({ where: { id: block.id } });

      res.json({ data: { success: true } });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * PUT /api/bots/:id/blocks-reorder — reorder blocks
 */
blocksRouter.put(
  '/:id/blocks-reorder',
  validate(reorderBlocksSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const botId = req.params.id as string;
      await getBotOrThrow(botId, req.userId!);

      const { blockIds } = req.body as { blockIds: string[] };

      const updates = blockIds.map((id, index) =>
        prisma.block.update({
          where: { id },
          data: { sortOrder: index * 100 },
        }),
      );

      await prisma.$transaction(updates);

      const blocks = await prisma.block.findMany({
        where: { botId },
        orderBy: { sortOrder: 'asc' },
      });

      res.json({ data: blocks });
    } catch (error) {
      next(error);
    }
  },
);
