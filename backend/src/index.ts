import express from 'express';
import cors from 'cors';
import { config } from './config';
import { getDb } from './db/schema';
import chatRouter from './routes/chat';

const app = express();

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '16kb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', store: 'CozyNest Home Goods' });
});

app.use('/chat', chatRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
);

getDb();

app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
  if (!config.geminiApiKey) {
    console.warn('WARNING: GEMINI_API_KEY is not set. LLM calls will fail.');
  }
});
