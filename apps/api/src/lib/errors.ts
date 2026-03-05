/** Базовый класс ошибки API */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public errors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** Ошибка 400 Bad Request */
export class BadRequestError extends AppError {
  constructor(message: string, errors?: Record<string, string[]>) {
    super(400, message, errors);
    this.name = 'BadRequestError';
  }
}

/** Ошибка 401 Unauthorized */
export class UnauthorizedError extends AppError {
  constructor(message = 'Необходима авторизация') {
    super(401, message);
    this.name = 'UnauthorizedError';
  }
}

/** Ошибка 403 Forbidden */
export class ForbiddenError extends AppError {
  constructor(message = 'Доступ запрещён') {
    super(403, message);
    this.name = 'ForbiddenError';
  }
}

/** Ошибка 404 Not Found */
export class NotFoundError extends AppError {
  constructor(message = 'Не найдено') {
    super(404, message);
    this.name = 'NotFoundError';
  }
}

/** Ошибка 409 Conflict */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message);
    this.name = 'ConflictError';
  }
}
