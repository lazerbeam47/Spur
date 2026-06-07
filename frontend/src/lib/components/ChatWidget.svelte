<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { sendMessage, fetchHistory, type ChatMessage, ApiError } from '$lib/api';
  import { getSessionId, setSessionId, clearSession } from '$lib/session';

  interface DisplayMessage {
    id: string;
    sender: 'user' | 'ai';
    text: string;
    isError?: boolean;
  }

  let messages: DisplayMessage[] = $state([]);
  let input = $state('');
  let loading = $state(false);
  let sessionId = $state<string | null>(null);
  let messagesEl: HTMLDivElement | undefined = $state();
  let initialized = $state(false);

  const suggestions = [
    "What's your return policy?",
    'Do you ship to the USA?',
    'What are your support hours?',
  ];

  async function scrollToBottom() {
    await tick();
    if (messagesEl) {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  }

  async function loadHistory() {
    const stored = getSessionId();
    if (!stored) return;

    try {
      const history = await fetchHistory(stored);
      sessionId = history.sessionId;
      messages = history.messages.map((m) => ({
        id: m.id,
        sender: m.sender,
        text: m.text,
      }));
      await scrollToBottom();
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        clearSession();
      }
    }
  }

  onMount(async () => {
    await loadHistory();
    initialized = true;
  });

  async function handleSend(text?: string) {
    const message = (text ?? input).trim();
    if (!message || loading) return;

    const tempId = `temp-${Date.now()}`;
    messages = [
      ...messages,
      { id: tempId, sender: 'user', text: message },
    ];
    input = '';
    loading = true;
    await scrollToBottom();

    try {
      const res = await sendMessage(message, sessionId ?? undefined);
      sessionId = res.sessionId;
      setSessionId(res.sessionId);

      messages = [
        ...messages,
        {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: res.reply,
          isError: res.error,
        },
      ];
    } catch (err) {
      const errorText =
        err instanceof ApiError
          ? err.message
          : 'Something went wrong. Please try again.';

      messages = [
        ...messages,
        {
          id: `err-${Date.now()}`,
          sender: 'ai',
          text: errorText,
          isError: true,
        },
      ];
    } finally {
      loading = false;
      await scrollToBottom();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function startNewChat() {
    clearSession();
    sessionId = null;
    messages = [];
    input = '';
  }

  // Helper: escape HTML to prevent XSS when rendering LLM output as HTML
  function escapeHtml(s: string = ''): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Render simple formatted HTML from plain text:
  // - Lines starting with "- " become list items inside a single <ul>
  // - Blank lines become paragraph breaks (<br>)
  // - Other lines become paragraphs
  function renderMessageAsHtml(text: string | undefined): string {
    if (!text) return '';
    const escaped = escapeHtml(text);
    const lines = escaped.split(/\r?\n/);

    let html = '';
    let inList = false;
    let paraBuffer: string[] = [];

    const flushPara = () => {
      if (paraBuffer.length === 0) return;
      html += '<p>' + paraBuffer.join(' ') + '</p>';
      paraBuffer = [];
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line.startsWith('- ')) {
        // flush any pending paragraph
        flushPara();
        if (!inList) {
          html += '<ul class="ai-list">';
          inList = true;
        }
        html += '<li>' + line.slice(2).trim() + '</li>';
      } else if (line === '') {
        // blank line -> paragraph break
        flushPara();
        if (inList) {
          html += '</ul>';
          inList = false;
        }
        // Intentionally do not insert an extra <br/> — paragraph blocks (<p>/<ul>) provide spacing.
      } else {
        if (inList) {
          html += '</ul>';
          inList = false;
        }
        paraBuffer.push(line);
      }
    }

    flushPara();
    if (inList) html += '</ul>';
    return html;
  }
</script>

<div class="chat-widget">
  <header class="chat-header">
    <div class="header-info">
      <div class="avatar">CN</div>
      <div>
        <h2>CozyNest Support</h2>
        <p class="status">
          {#if loading}
            <span class="typing-dot"></span> Agent is typing…
          {:else}
            <span class="online-dot"></span> Online
          {/if}
        </p>
      </div>
    </div>
    {#if messages.length > 0}
      <button class="new-chat-btn" onclick={startNewChat} title="Start new conversation">
        New chat
      </button>
    {/if}
  </header>

  <div class="messages" bind:this={messagesEl}>
    {#if initialized && messages.length === 0}
      <div class="welcome">
        <p>Hi there! 👋 I'm the CozyNest support agent.</p>
        <p>Ask me about shipping, returns, support hours, and more.</p>
        <div class="suggestions">
          {#each suggestions as suggestion}
            <button
              class="suggestion"
              onclick={() => handleSend(suggestion)}
              disabled={loading}
            >
              {suggestion}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    {#each messages as msg (msg.id)}
      <div class="message-row {msg.sender}">
        {#if msg.sender === 'ai'}
          <div class="msg-avatar">AI</div>
        {/if}
        <div class="bubble {msg.sender} {msg.isError ? 'error' : ''}">
          {@html renderMessageAsHtml(msg.text)}
        </div>
      </div>
    {/each}

    {#if loading}
      <div class="message-row ai">
        <div class="msg-avatar">AI</div>
        <div class="bubble ai typing-bubble">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
      </div>
    {/if}
  </div>

  <footer class="input-area">
    <textarea
      bind:value={input}
      onkeydown={handleKeydown}
      placeholder="Type your message…"
      rows="1"
      disabled={loading}
      maxlength="2000"
      aria-label="Chat message input"
    ></textarea>
    <button
      class="send-btn"
      onclick={() => handleSend()}
      disabled={loading || !input.trim()}
      aria-label="Send message"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
      </svg>
    </button>
  </footer>
</div>

<style>
  .chat-widget {
    display: flex;
    flex-direction: column;
    height: 100%;
    max-height: 640px;
    background: #fff;
    border-radius: 16px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
    overflow: hidden;
    font-family: 'Inter', system-ui, sans-serif;
  }

  .chat-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    background: linear-gradient(135deg, #2d6a4f 0%, #40916c 100%);
    color: #fff;
  }

  .header-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 14px;
  }

  .chat-header h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  .status {
    margin: 2px 0 0;
    font-size: 12px;
    opacity: 0.85;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .online-dot,
  .typing-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #95d5b2;
    display: inline-block;
  }

  .typing-dot {
    animation: pulse 1.2s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .new-chat-btn {
    background: rgba(255, 255, 255, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.3);
    color: #fff;
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 12px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .new-chat-btn:hover {
    background: rgba(255, 255, 255, 0.25);
  }

  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: #f8faf9;
  }

  .welcome {
    text-align: center;
    color: #555;
    padding: 24px 12px;
  }

  .welcome p {
    margin: 0 0 8px;
    font-size: 14px;
    line-height: 1.5;
  }

  .suggestions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 16px;
  }

  .suggestion {
    background: #fff;
    border: 1px solid #d8e2dc;
    border-radius: 20px;
    padding: 10px 16px;
    font-size: 13px;
    color: #2d6a4f;
    cursor: pointer;
    transition: all 0.15s;
    text-align: left;
  }

  .suggestion:hover:not(:disabled) {
    background: #e8f5e9;
    border-color: #40916c;
  }

  .suggestion:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .message-row {
    display: flex;
    align-items: flex-end;
    gap: 8px;
  }

  .message-row.user {
    justify-content: flex-end;
  }

  .msg-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #40916c;
    color: #fff;
    font-size: 10px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .bubble {
    max-width: 75%;
    padding: 10px 14px;
    border-radius: 16px;
    font-size: 14px;
    line-height: 1.5;
    word-wrap: break-word;
  }

  .bubble.user {
    background: #2d6a4f;
    color: #fff;
    border-bottom-right-radius: 4px;
  }

  .bubble.ai {
    background: #fff;
    color: #333;
    border: 1px solid #e8ece9;
    border-bottom-left-radius: 4px;
  }

  .ai-list {
    margin: 6px 0 6px 18px;
    padding: 0;
  }

  .ai-list li {
    margin: 4px 0;
  }

  .bubble p {
    margin: 6px 0;
  }

  .bubble.error {
    background: #fef2f2;
    border-color: #fecaca;
    color: #991b1b;
  }

  .typing-bubble {
    display: flex;
    gap: 4px;
    padding: 14px 18px;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #aaa;
    animation: bounce 1.4s infinite ease-in-out both;
  }

  .dot:nth-child(1) { animation-delay: -0.32s; }
  .dot:nth-child(2) { animation-delay: -0.16s; }

  @keyframes bounce {
    0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
    40% { transform: scale(1); opacity: 1; }
  }

  .input-area {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid #e8ece9;
    background: #fff;
  }

  textarea {
    flex: 1;
    border: 1px solid #d8e2dc;
    border-radius: 12px;
    padding: 10px 14px;
    font-size: 14px;
    font-family: inherit;
    resize: none;
    outline: none;
    max-height: 100px;
    line-height: 1.4;
    transition: border-color 0.15s;
  }

  textarea:focus {
    border-color: #40916c;
  }

  textarea:disabled {
    background: #f5f5f5;
    cursor: not-allowed;
  }

  .send-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: none;
    background: #2d6a4f;
    color: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: background 0.15s, opacity 0.15s;
  }

  .send-btn:hover:not(:disabled) {
    background: #40916c;
  }

  .send-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
