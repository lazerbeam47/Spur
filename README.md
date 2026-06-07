# Spur — AI Live Chat Agent

A mini customer support chat app where an AI agent answers questions about a fictional e-commerce store (**CozyNest Home Goods**) using the Google Gemini API.

**Live demo:** _(add your deployed URL here)](https://spur-gvj99ebpt-dabbumothseras-projects.vercel.app/)_

---

## Quick Start

### Prerequisites

- Node.js 18+
- A [Google Gemini API key](https://aistudio.google.com/apikey)

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edit .env and set GEMINI_API_KEY=your_key_here

npm install
npm run db:seed   # initializes SQLite schema
npm run dev       # starts on http://localhost:3001
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env   # default points to http://localhost:3001

npm install
npm run dev            # starts on http://localhost:5173
```

Open http://localhost:5173 and start chatting.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `GEMINI_API_KEY` | _(required)_ | Google Gemini API key |
| `PORT` | `3001` | Server port |
| `DATABASE_PATH` | `./data/chat.db` | SQLite database file path |
| `CORS_ORIGIN` | `*` | Allowed frontend origin. Set this to your Vercel URL in production. |
| `MAX_MESSAGE_LENGTH` | `2000` | Max chars per message (truncated if exceeded) |
| `MAX_HISTORY_MESSAGES` | `20` | Conversation history sent to LLM |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Gemini model name |
| `LLM_TIMEOUT_MS` | `30000` | LLM request timeout in ms |

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|---|---|---|
| `PUBLIC_API_URL` | `https://spur-qf4p.onrender.com` | Backend API base URL |

---

## API

### `POST /chat/message`

Send a user message and receive an AI reply.

**Request:**
```json
{ "message": "What's your return policy?", "sessionId": "optional-uuid" }
```

**Response:**
```json
{ "reply": "...", "sessionId": "uuid", "error": false }
```

### `GET /chat/history/:sessionId`

Fetch all messages for a conversation (used on page reload).

**Response:**
```json
{
  "sessionId": "uuid",
  "messages": [
    { "id": "...", "sender": "user", "text": "...", "timestamp": "..." }
  ]
}
```

### `GET /health`

Health check endpoint.

---

## Architecture

```
Spur/
├── backend/
│   └── src/
│       ├── index.ts              # Express app entry
│       ├── config.ts             # Env config
│       ├── routes/chat.ts        # HTTP route handlers
│       ├── services/
│       │   ├── chat.ts           # Business logic (validation, persistence, orchestration)
│       │   └── llm.ts            # Gemini integration (encapsulated)
│       ├── db/
│       │   ├── schema.ts         # SQLite schema + connection
│       │   └── seed.ts           # DB init script
│       └── data/
│           └── store-knowledge.ts # Fictional store FAQ (injected into system prompt)
└── frontend/
    └── src/
        ├── routes/+page.svelte    # Landing page
        └── lib/
            ├── api.ts             # Backend HTTP client
            ├── session.ts         # localStorage session management
            └── components/
                └── ChatWidget.svelte
```

### Design Decisions

1. **Layered backend** — Routes handle HTTP concerns only; `chat.ts` owns business logic; `llm.ts` is the single integration point for Gemini. Adding WhatsApp/Instagram later means adding new route handlers that call the same `handleChatMessage` service.

2. **SQLite over PostgreSQL** — Zero external dependencies for local dev and easy deployment. Schema is portable to Postgres if needed (simple two-table design).

3. **Store knowledge in system prompt** — FAQ data lives in `store-knowledge.ts` and is injected as a system instruction. Keeps the DB schema minimal and makes knowledge easy to update without migrations.

4. **Session via localStorage** — No auth required per spec. `sessionId` (UUID) is stored client-side and sent with each message. On reload, history is fetched from `GET /chat/history/:sessionId`.

5. **Error messages persisted as AI messages** — When the LLM fails, a friendly error is saved to the DB as an AI message so conversation history stays coherent.

6. **SvelteKit + static adapter** — Frontend builds to static files, deployable to Vercel/Netlify. Backend deploys separately (Render, Railway, etc.).

---

## LLM Integration

- **Provider:** Google Gemini (`@google/generative-ai`)
- **Model:** `gemini-2.5-flash` (fast, cost-effective)
- **Prompting:**
  - System instruction with store persona + full FAQ knowledge base
  - Conversation history (last 20 messages) passed as multi-turn content
  - `maxOutputTokens: 512`, `temperature: 0.7`
- **Guardrails:**
  - 30s timeout via `Promise.race`
  - API key / rate limit / timeout errors mapped to user-friendly messages
  - Empty responses caught and surfaced
  - Input truncated at 2000 chars (configurable)

---

## Database Schema

```sql
conversations (id TEXT PK, created_at, updated_at)
messages      (id TEXT PK, conversation_id FK, sender, text, created_at)
```

No seed data required — conversations are created on first message.

---

## Deployment

### Backend (e.g. Render)

1. Create a Web Service pointing to `backend/`
2. Build: `npm install && npm run build`
3. Start: `npm start`
4. Set env vars: `GEMINI_API_KEY`, `CORS_ORIGIN` (your frontend URL; defaults to `*` if unset)
5. Note: SQLite on ephemeral filesystems loses data on restart. For production, swap to PostgreSQL.

### Frontend (e.g. Vercel / Netlify)

1. Root directory: `frontend/`
2. Build: `npm run build`
3. Set `PUBLIC_API_URL` to `https://spur-qf4p.onrender.com`

---

## Trade-offs & If I Had More Time

| Done | Would add with more time |
|---|---|
| SQLite persistence | PostgreSQL for production durability |
| Gemini flash model | Model fallback chain (flash → pro) |
| Basic input validation | Rate limiting per session/IP |
| Static FAQ in prompt | DB-driven knowledge base with admin UI |
| localStorage sessions | Optional auth for returning customers |
| Single-channel chat widget | Channel abstraction layer (WhatsApp, IG, etc.) |
| Error handling | Retry with exponential backoff for transient LLM failures |
| — | Redis caching for repeated FAQ queries |
| — | Streaming responses (SSE) for faster perceived latency |
| — | Unit/integration tests for services and API routes |

---

## Tech Stack

- **Backend:** Node.js, TypeScript, Express, better-sqlite3
- **Frontend:** SvelteKit, Svelte 5, Vite
- **LLM:** Google Gemini API
- **Database:** SQLite
