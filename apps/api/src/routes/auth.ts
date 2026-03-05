import { Router, Request, Response, NextFunction } from 'express';
import { registerSchema, loginSchema } from '@tg-bots/shared';
import { validate } from '../middleware/validate';
import * as authService from '../services/authService';

export const authRouter = Router();

authRouter.post(
  '/register',
  validate(registerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.register(req.body.email, req.body.password);
      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

authRouter.post(
  '/login',
  validate(loginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.login(req.body.email, req.body.password);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

authRouter.post(
  '/refresh',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        res.status(400).json({ message: 'refreshToken обязателен' });
        return;
      }
      const result = await authService.refresh(refreshToken);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

authRouter.post(
  '/logout',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body;
      if (refreshToken) {
        await authService.logout(refreshToken);
      }
      res.json({ data: { success: true } });
    } catch (error) {
      next(error);
    }
  },
);
