import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  console.error('Error:', err);

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      message: err.message,
      ...(err.errors && { errors: err.errors }),
    });
    return;
  }

  res.status(500).json({
    message: 'Внутренняя ошибка сервера',
  });
}
