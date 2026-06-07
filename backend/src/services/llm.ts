import { GoogleGenerativeAI, type Content } from '@google/generative-ai';
import { config } from '../config';
import { STORE_KNOWLEDGE, STORE_NAME } from '../data/store-knowledge';
import type { Message } from '../db/schema';

const SYSTEM_PROMPT = `You are a helpful customer support agent for ${STORE_NAME}, a small e-commerce store.

Answer clearly and concisely. Be friendly and professional. If you don't know something based on the store knowledge below, say so honestly and offer to connect the customer with a human agent during support hours.

Do not make up policies, prices, or product details not covered in the knowledge base.

## Store Knowledge
${STORE_KNOWLEDGE}`;

export class LlmError extends Error {
  constructor(
    message: string,
    public readonly userMessage: string
  ) {
    super(message);
    this.name = 'LlmError';
  }
}

function buildContents(history: Message[], userMessage: string): Content[] {
  const contents: Content[] = [];

  for (const msg of history) {
    contents.push({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }],
    });
  }

  contents.push({
    role: 'user',
    parts: [{ text: userMessage }],
  });

  return contents;
}

function mapGeminiError(error: unknown): LlmError {
  const err = error as { status?: number; message?: string };

  if (err.status === 401 || err.status === 403) {
    return new LlmError(
      'Invalid API key',
      'Our support agent is temporarily unavailable due to a configuration issue. Please try again later.'
    );
  }

  if (err.status === 429) {
    return new LlmError(
      'Rate limit exceeded',
      'We\'re experiencing high demand right now. Please wait a moment and try again.'
    );
  }

  if (err.message?.includes('timeout') || err.message?.includes('DEADLINE_EXCEEDED')) {
    return new LlmError(
      'Request timeout',
      'The request took too long. Please try again with a shorter message.'
    );
  }

  return new LlmError(
    err.message || 'Unknown LLM error',
    'Sorry, I couldn\'t process your message right now. Please try again in a moment.'
  );
}

/**
 * Normalize common markdown-like formatting returned by the LLM so the UI
 * shows clean, consistent plain-text bullet lists and paragraphs.
 */
function formatLlmOutput(raw: string): string {
  if (!raw) return raw;

  // Normalize line endings and trim
  let s = raw.replace(/\r\n/g, '\n').trim();

  // Move punctuation-attached bullets to their own lines and turn inline " - " or " * " into new list items
  s = s.replace(/([:;.,!?])\s*[-*]\s*/g, '$1\n- ');
  s = s.replace(/\s-\s+/g, '\n- ');
  s = s.replace(/\s\*\s+/g, '\n- ');

  // Convert leading asterisk bullets at line start to hyphen bullets
  s = s.replace(/^\s*\*\s+/gm, '- ');

  // Strip paired emphasis markers like *text* -> text
  s = s.replace(/\*(.*?)\*/g, '$1');

  // Normalize multiple hyphens/spaces to a single '- '
  s = s.replace(/-+\s+/g, '- ');

  // Collapse 3+ blank lines into two
  s = s.replace(/\n{3,}/g, '\n\n');

  // Trim trailing whitespace on lines
  const rawLines = s.split('\n').map(l => l.replace(/\s+$/g, ''));

  // Group lines into blocks: consecutive '- ' lines -> list block; consecutive non-empty non-list lines -> paragraph
  const blocks: string[] = [];
  let i = 0;
  while (i < rawLines.length) {
    const line = rawLines[i].trim();
    if (line === '') { i++; continue; }

    if (line.startsWith('- ')) {
      const items: string[] = [];
      while (i < rawLines.length) {
        const ln = rawLines[i].trim();
        if (ln.startsWith('- ')) {
          // ensure single '- ' prefix
          items.push(ln.startsWith('- ') ? ln : '- ' + ln);
          i++;
        } else if (ln === '') {
          i++; break;
        } else break;
      }
      blocks.push(items.join('\n'));
      continue;
    }

    // paragraph block
    const para: string[] = [];
    while (i < rawLines.length) {
      const ln = rawLines[i].trim();
      if (ln === '' ) { i++; break; }
      if (ln.startsWith('- ')) break;
      para.push(ln);
      i++;
    }
    if (para.length) blocks.push(para.join(' '));
  }

  s = blocks.join('\n\n');

  return s;
}

export async function generateReply(
  history: Message[],
  userMessage: string
): Promise<string> {
  if (!config.geminiApiKey) {
    throw new LlmError(
      'Missing GEMINI_API_KEY',
      'Our support agent is not configured yet. Please contact the store administrator.'
    );
  }

  const genAI = new GoogleGenerativeAI(config.geminiApiKey);
  const model = genAI.getGenerativeModel({
    model: config.geminiModel,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      maxOutputTokens: 512,
      temperature: 0.7,
    },
  });

  const contents = buildContents(history, userMessage);

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new LlmError('Timeout', 'The request took too long. Please try again.')), config.llmTimeoutMs);
  });

  try {
    const result = await Promise.race([
      model.generateContent({ contents }),
      timeoutPromise,
    ]);

    const text = result.response.text();
    if (!text?.trim()) {
      throw new LlmError('Empty response', 'I couldn\'t generate a response. Please try rephrasing your question.');
    }

    // Normalize common markdown-like formatting the LLM sometimes returns
    return formatLlmOutput(text.trim());
  } catch (error) {
    if (error instanceof LlmError) throw error;
    throw mapGeminiError(error);
  }
}
