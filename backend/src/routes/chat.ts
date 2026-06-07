import { Router, type Request, type Response } from 'express';
import { handleChatMessage, getChatHistory, ValidationError } from '../services/chat';

const router = Router();

router.post('/message', async (req: Request, res: Response) => {
  try {
    const { message, sessionId } = req.body ?? {};

    const result = await handleChatMessage(message, sessionId);

    res.json(result);
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }

    console.error('Unexpected error in POST /chat/message:', error);
    res.status(500).json({
      error: 'An unexpected error occurred. Please try again.',
    });
  }
});

router.get('/history/:sessionId', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId || typeof sessionId !== 'string') {
      res.status(400).json({ error: 'Invalid session ID.' });
      return;
    }

    const history = getChatHistory(sessionId);

    if (!history) {
      res.status(404).json({ error: 'Conversation not found.' });
      return;
    }

    res.json(history);
  } catch (error) {
    console.error('Unexpected error in GET /chat/history:', error);
    res.status(500).json({
      error: 'An unexpected error occurred. Please try again.',
    });
  }
});

export default router;
