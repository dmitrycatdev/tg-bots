import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { authRouter } from './routes/auth';
import { botsRouter } from './routes/bots';
import { blocksRouter } from './routes/blocks';
import { answersRouter } from './routes/answers';
import { webhookRouter } from './routes/webhook';
import { errorHandler } from './middleware/errorHandler';
import { botManager } from './services/botManager';

const app = express();

// Webhook route must be before json middleware for raw body access
app.use('/api/webhook', webhookRouter);

app.use(helmet());
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json());

// API routes
app.use('/api/auth', authRouter);
app.use('/api/bots', botsRouter);
app.use('/api/bots', blocksRouter);
app.use('/api/bots', answersRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Error handler
app.use(errorHandler);

async function start() {
  try {
    await botManager.loadActiveBots();
    app.listen(config.port, () => {
      console.log(`API server running on port ${config.port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
