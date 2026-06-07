import { env } from '$env/dynamic/public';

const API_BASE = env.PUBLIC_API_URL ?? 'https://spur-qf4p.onrender.com';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

export interface SendMessageResponse {
  reply: string;
  sessionId: string;
  error?: boolean;
}

export interface HistoryResponse {
  sessionId: string;
  messages: ChatMessage[];
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response;

  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
  } catch {
    throw new ApiError(
      'Unable to reach the server. Please check your connection.',
      0
    );
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(
      data.error || `Request failed (${res.status})`,
      res.status
    );
  }

  return data as T;
}

export function sendMessage(
  message: string,
  sessionId?: string
): Promise<SendMessageResponse> {
  return request<SendMessageResponse>('/chat/message', {
    method: 'POST',
    body: JSON.stringify({ message, sessionId }),
  });
}

export function fetchHistory(sessionId: string): Promise<HistoryResponse> {
  return request<HistoryResponse>(`/chat/history/${sessionId}`);
}
