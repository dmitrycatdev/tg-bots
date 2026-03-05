import { z } from 'zod';
import { BlockType, AnswerType } from './enums';
import {
  MAX_BLOCK_TEXT_LENGTH,
  MAX_BOT_NAME_LENGTH,
  MAX_OPTION_TEXT_LENGTH,
  MAX_OPTIONS_PER_BLOCK,
} from './constants';

// ==================== Auth ====================

/** Схема регистрации пользователя */
export const registerSchema = z.object({
  email: z.string().email('Некорректный email'),
  password: z.string().min(6, 'Пароль должен содержать минимум 6 символов'),
});

/** Схема входа в систему */
export const loginSchema = z.object({
  email: z.string().email('Некорректный email'),
  password: z.string().min(1, 'Введите пароль'),
});

// ==================== Bots ====================

/** Схема создания бота */
export const createBotSchema = z.object({
  name: z.string().min(1, 'Введите название бота').max(MAX_BOT_NAME_LENGTH),
  token: z.string().min(1, 'Введите токен бота'),
});

// ==================== Blocks ====================

/** Схема создания блока */
export const createBlockSchema = z.object({
  type: z.nativeEnum(BlockType),
  text: z.string().min(1, 'Введите текст блока').max(MAX_BLOCK_TEXT_LENGTH),
  mediaUrl: z.string().url().nullable().optional(),
  answerType: z.nativeEnum(AnswerType).nullable().optional(),
  options: z
    .array(z.string().min(1).max(MAX_OPTION_TEXT_LENGTH))
    .max(MAX_OPTIONS_PER_BLOCK)
    .nullable()
    .optional(),
  buttonText: z.string().max(64).nullable().optional(),
  isRequired: z.boolean().optional().default(true),
});

/** Схема обновления блока */
export const updateBlockSchema = createBlockSchema.partial();

/** Схема пересортировки блоков */
export const reorderBlocksSchema = z.object({
  blockIds: z.array(z.string().uuid()),
});

// ==================== Types inferred from schemas ====================

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateBotInput = z.infer<typeof createBotSchema>;
export type CreateBlockInput = z.infer<typeof createBlockSchema>;
export type UpdateBlockInput = z.infer<typeof updateBlockSchema>;
export type ReorderBlocksInput = z.infer<typeof reorderBlocksSchema>;
