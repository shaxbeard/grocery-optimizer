# Plan

Stack: Express 5 + better-sqlite3 (server), React + Vite (client), Vitest + Supertest + Testing Library (unit), Playwright (integration). Plain CSS using the project color scheme. npm workspaces: `server/`, `client/`.

## Data model

- `items`: id, name, category, unit, quantity (on hand), target (desired minimum)
- `prices`: id, item_id, store, price, updated_at; unique (item_id, store)
- `lists`: id, name, created_at
- `list_items`: id, list_id, item_id, quantity, purchased

## API

- `GET/POST /api/items`, `PUT/DELETE /api/items/:id`
- `PUT /api/items/:id/prices` (upsert store price), `DELETE /api/prices/:id`
- `GET/POST /api/lists`, `GET/DELETE /api/lists/:id`, `POST /api/lists/from-inventory`
- `POST /api/lists/:id/items`, `DELETE /api/list-items/:id`
- `PUT /api/list-items/:id/purchased` (toggle; adjusts inventory)

## Phases

### 1. Scaffolding
- [x] Root `package.json` with workspaces, `.gitignore`, minimal README
- [x] Server and client packages install and start
- [x] `npm test` runs all unit tests

### 2. Backend
- [x] SQLite schema created on startup (path configurable, `:memory:` in tests)
- [x] Item CRUD, category filter
- [x] Price upsert returns best (lowest) price per item
- [x] Shopping lists: create, generate from low stock, add/remove items
- [x] Marking purchased increases inventory; unmarking reverts it
- [x] Unit tests for every endpoint, including validation errors

### 3. Frontend
- [x] Onboarding screen when no items exist
- [x] Dashboard with category filter, inventory editing, best price shown
- [x] Item detail: edit prices per store
- [x] Shopping lists view: create, generate from inventory, add items, mark purchased
- [x] Color scheme and layout per AGENTS.md
- [x] Component tests for onboarding, dashboard, shopping list

### 4. Integration
- [x] Playwright tests: onboarding, filtering, price entry, list generation, purchase updates inventory
- [x] Defects found are fixed

### 5. Finish
- [x] Production build served by Express on one port
- [x] Server running and ready for the user
