import Database from 'better-sqlite3'

export function openDb(path = 'grocery.db') {
  const db = new Database(path)
  db.pragma('foreign_keys = ON')
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'pantry',
      unit TEXT NOT NULL DEFAULT '',
      quantity REAL NOT NULL DEFAULT 0,
      target REAL NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS prices (
      id INTEGER PRIMARY KEY,
      item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      store TEXT NOT NULL,
      price REAL NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (item_id, store)
    );
    CREATE TABLE IF NOT EXISTS lists (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS list_items (
      id INTEGER PRIMARY KEY,
      list_id INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      quantity REAL NOT NULL DEFAULT 1,
      purchased INTEGER NOT NULL DEFAULT 0,
      UNIQUE (list_id, item_id)
    );
  `)
  return db
}
