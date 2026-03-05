import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { BadRequestError } from '../lib/errors';

/**
 * Middleware для валидации тела запроса через zod-схему
 */
export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors: Record<string, string[]> = {};
        for (const issue of error.issues) {
          const key = issue.path.join('.');
          if (!errors[key]) errors[key] = [];
          errors[key].push(issue.message);
        }
        next(new BadRequestError('Ошибка валидации', errors));
      } else {
        next(error);
      }
    }
  };
}
