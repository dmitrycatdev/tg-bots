/** Максимальное количество блоков в сценарии (MVP) */
export const MAX_BLOCKS_PER_BOT = 12;

/** Максимальное количество вариантов ответа */
export const MAX_OPTIONS_PER_BLOCK = 10;

/** Максимальная длина текста блока */
export const MAX_BLOCK_TEXT_LENGTH = 4096;

/** Максимальная длина текста варианта ответа */
export const MAX_OPTION_TEXT_LENGTH = 200;

/** Максимальная длина названия бота */
export const MAX_BOT_NAME_LENGTH = 100;

/** Максимальная длина ответа респондента */
export const MAX_ANSWER_LENGTH = 4096;

/** Сообщения об ошибках */
export const ERROR_MESSAGES = {
  INVALID_TOKEN: 'Неверный токен. Проверьте, правильно ли вы скопировали его у @BotFather',
  BOT_NOT_FOUND: 'Бот не найден',
  BLOCK_NOT_FOUND: 'Блок не найден',
  UNAUTHORIZED: 'Необходима авторизация',
  FORBIDDEN: 'Доступ запрещён',
  INVALID_EMAIL: 'Некорректный email',
  PASSWORD_TOO_SHORT: 'Пароль должен содержать минимум 6 символов',
  EMAIL_ALREADY_EXISTS: 'Пользователь с таким email уже существует',
  INVALID_CREDENTIALS: 'Неверный email или пароль',
  PLEASE_SELECT_OPTION: 'Пожалуйста, выберите один из предложенных вариантов',
  PLEASE_SELECT_RATING: 'Пожалуйста, нажмите одну из кнопок для выставления оценки',
} as const;

/** Фиксированный диапазон для типа ответа RATING */
export const RATING_MIN = 1;
export const RATING_MAX = 5;
