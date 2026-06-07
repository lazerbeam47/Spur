/**
 * Seed script — run with `npm run db:seed`
 *
 * Store knowledge is embedded in the LLM system prompt (see services/llm.ts).
 * This script initializes the database schema. No seed rows are required
 * since conversations are created on first message.
 */
import { getDb } from './schema';

const db = getDb();
console.log('Database initialized at:', db.name);
console.log('Store FAQ knowledge is configured in the LLM system prompt.');
db.close();
