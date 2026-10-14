import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";
import { existsSync, mkdirSync } from "fs";
import { dirname } from "path";

const dbPath = process.env.DATABASE_PATH || "orders.sqlite";
const dbDir = dirname(dbPath);
if (dbDir && dbDir !== "." && !existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

const sqlite = new Database(dbPath);

// Auto-create table if not exists
sqlite.run(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_address TEXT NOT NULL,
    customer_comment TEXT,
    items_json TEXT NOT NULL,
    total_amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    admin_comment TEXT,
    estimated_minutes INTEGER DEFAULT 25,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`);

export const db = drizzle({ client: sqlite, schema });
export { sqlite };
