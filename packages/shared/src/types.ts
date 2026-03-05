import { BlockType, AnswerType, RespondentStatus } from './enums';

/** Пользователь системы (владелец ботов) */
export interface User {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

/** Telegram-бот */
export interface Bot {
  id: string;
  userId: string;
  name: string;
  telegramBotId: string;
  telegramUsername: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Блок сценария */
export interface Block {
  id: string;
  botId: string;
  type: BlockType;
  sortOrder: number;
  text: string;
  mediaUrl: string | null;
  answerType: AnswerType | null;
  options: string[] | null;
  buttonText: string | null;
  isRequired: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Респондент (конечный пользователь Telegram) */
export interface Respondent {
  id: string;
  botId: string;
  chatId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  currentBlockId: string | null;
  status: RespondentStatus;
  createdAt: string;
  updatedAt: string;
}

/** Ответ респондента */
export interface Answer {
  id: string;
  respondentId: string;
  blockId: string;
  value: string;
  createdAt: string;
}

/** Ответ API с токенами авторизации */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/** Ответ API при входе/регистрации */
export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

/** Строка таблицы ответов */
export interface AnswerRow {
  respondentId: string;
  chatId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  status: RespondentStatus;
  answers: Record<string, string>;
  completedAt: string | null;
}

/** Общий формат ответа API */
export interface ApiResponse<T> {
  data: T;
}

/** Формат ошибки API */
export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}
