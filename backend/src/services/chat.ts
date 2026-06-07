import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { getDb, type Message } from '../db/schema';
import { generateReply, LlmError } from './llm';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export interface ChatMessageResult {
  reply: string;
  sessionId: string;
  error?: boolean;
}

export interface HistoryResult {
  sessionId: string;
  messages: Array<{
    id: string;
    sender: 'user' | 'ai';
    text: string;
    timestamp: string;
  }>;
}

function validateMessage(message: unknown): string {
  if (typeof message !== 'string') {
    throw new ValidationError('Message must be a string.');
  }

  const trimmed = message.trim();
  if (!trimmed) {
    throw new ValidationError('Message cannot be empty.');
  }

  if (trimmed.length > config.maxMessageLength) {
    return trimmed.slice(0, config.maxMessageLength);
  }

  return trimmed;
}

function getOrCreateConversation(sessionId?: string): string {
  const db = getDb();

  if (sessionId) {
    const existing = db
      .prepare('SELECT id FROM conversations WHERE id = ?')
      .get(sessionId) as { id: string } | undefined;

    if (existing) return existing.id;
  }

  const id = uuidv4();
  db.prepare('INSERT INTO conversations (id) VALUES (?)').run(id);
  return id;
}

function saveMessage(
  conversationId: string,
  sender: 'user' | 'ai',
  text: string
): Message {
  const db = getDb();
  const id = uuidv4();

  db.prepare(
    'INSERT INTO messages (id, conversation_id, sender, text) VALUES (?, ?, ?, ?)'
  ).run(id, conversationId, sender, text);

  db.prepare(
    "UPDATE conversations SET updated_at = datetime('now') WHERE id = ?"
  ).run(conversationId);

  const row = db
    .prepare('SELECT * FROM messages WHERE id = ?')
    .get(id) as Message;

  return row;
}

function getConversationHistory(conversationId: string): Message[] {
  const db = getDb();
  const limit = config.maxHistoryMessages;

  const rows = db
    .prepare(
      `SELECT * FROM messages
       WHERE conversation_id = ?
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .all(conversationId, limit) as Message[];

  return rows.reverse();
}

export async function handleChatMessage(
  rawMessage: unknown,
  sessionId?: string
): Promise<ChatMessageResult> {
  const message = validateMessage(rawMessage);
  const conversationId = getOrCreateConversation(sessionId);

  saveMessage(conversationId, 'user', message);

  const history = getConversationHistory(conversationId).slice(0, -1);

  try {
    const reply = await generateReply(history, message);
    saveMessage(conversationId, 'ai', reply);

    return { reply, sessionId: conversationId };
  } catch (error) {
    const userFacing =
      error instanceof LlmError
        ? error.userMessage
        : 'Something went wrong. Please try again.';

    saveMessage(conversationId, 'ai', userFacing);

    return { reply: userFacing, sessionId: conversationId, error: true };
  }
}

export function getChatHistory(sessionId: string): HistoryResult | null {
  const db = getDb();

  const conversation = db
    .prepare('SELECT id FROM conversations WHERE id = ?')
    .get(sessionId) as { id: string } | undefined;

  if (!conversation) return null;

  const messages = db
    .prepare(
      `SELECT id, sender, text, created_at
       FROM messages
       WHERE conversation_id = ?
       ORDER BY created_at ASC`
    )
    .all(sessionId) as Array<{
    id: string;
    sender: 'user' | 'ai';
    text: string;
    created_at: string;
  }>;

  return {
    sessionId,
    messages: messages.map((m) => ({
      id: m.id,
      sender: m.sender,
      text: m.text,
      timestamp: m.created_at,
    })),
  };
}
