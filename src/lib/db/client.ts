import { mkdirSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

const sqlitePath = process.env.SQLITE_PATH ?? "studio.sqlite";
const sqliteDirectory = path.dirname(sqlitePath);

if (sqliteDirectory !== ".") {
  mkdirSync(sqliteDirectory, { recursive: true });
}

const globalForDb = globalThis as unknown as {
  studioDb?: Database.Database;
};

export const db =
  globalForDb.studioDb ??
  new Database(sqlitePath, {
    fileMustExist: false,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.studioDb = db;
}

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function now() {
  return new Date().toISOString();
}

export function makeId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

export function parseJsonArray(value: unknown): string[] {
  if (!value || typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
  } catch {
    return [];
  }
}

export function toJsonArray(value: unknown) {
  if (!Array.isArray(value)) {
    return "[]";
  }

  return JSON.stringify(value.filter(Boolean).map(String));
}
