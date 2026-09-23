import path from 'node:path';
import Database from 'better-sqlite3';

// The bundled SQLite file is a read-only asset shipped with the deployment
// (see README "Data & the SQLite file"). We only ever SELECT from it —
// Vercel's serverless filesystem is ephemeral/read-only in practice, so no
// route may write to this connection.
const DB_PATH = path.join(process.cwd(), 'data', 'scholarships.db');

let db: Database.Database | undefined;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  }
  return db;
}
