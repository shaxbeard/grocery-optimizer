import Database from 'better-sqlite3'
import { fileURLToPath } from 'node:url'

export function openDb(path = fileURLToPath(new URL('../../grocery.db', import.meta.url))) {
  const db = new Database(path)
  db.pragma('foreign_keys = ON')
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'pantry',
      unit TEXT NOT NULL DEFAULT '',
      quantity REAL NOT NULL DEFAULT 0,
      target REAL NOT NULL DEFAULT 0,
      weekly INTEGER NOT NULL DEFAULT 0,
      per_week REAL NOT NULL DEFAULT 0,
      max_buy REAL NOT NULL DEFAULT 0,
      package_amount REAL CHECK (package_amount > 0),
      package_unit TEXT NOT NULL DEFAULT 'g' CHECK (package_unit IN ('g', 'mL', 'L', 'count'))
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
  const columns = db.pragma('table_info(items)').map((c) => c.name)
  if (!columns.includes('weekly')) {
    db.exec('ALTER TABLE items ADD COLUMN weekly INTEGER NOT NULL DEFAULT 0')
    db.exec('ALTER TABLE items ADD COLUMN per_week REAL NOT NULL DEFAULT 0')
  }
  if (!columns.includes('max_buy')) {
    db.exec('ALTER TABLE items ADD COLUMN max_buy REAL NOT NULL DEFAULT 0')
  }
  if (!columns.includes('package_amount') || !columns.includes('package_unit')) {
    db.transaction(() => {
      if (columns.includes('package_grams')) {
        db.exec('ALTER TABLE items RENAME COLUMN package_grams TO package_amount')
      } else if (!columns.includes('package_amount')) {
        db.exec('ALTER TABLE items ADD COLUMN package_amount REAL CHECK (package_amount > 0)')
      }
      if (!columns.includes('package_unit')) {
        db.exec("ALTER TABLE items ADD COLUMN package_unit TEXT NOT NULL DEFAULT 'g' CHECK (package_unit IN ('g', 'mL', 'L', 'count'))")
      }
    })()
  }
  return db
}
