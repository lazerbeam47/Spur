import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  databasePath: process.env.DATABASE_PATH || path.join(__dirname, '../data/chat.db'),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  maxMessageLength: parseInt(process.env.MAX_MESSAGE_LENGTH || '2000', 10),
  maxHistoryMessages: parseInt(process.env.MAX_HISTORY_MESSAGES || '20', 10),
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  llmTimeoutMs: parseInt(process.env.LLM_TIMEOUT_MS || '30000', 10),
};
