# Grocery Manager

Track groceries, store prices, inventory and shopping lists.

Type any part of an item name in **Search items** to filter the inventory alongside the category and weekly filters.
The **Fridge** category replaces **Dairy**; existing items move automatically.

Set an optional package size in grams, millilitres, litres, or item count. The app uses that size for all of the item's store prices and shows the cost per 100 g, per litre, or per item.
When adding an item, you can also enter its first package price. A store is required only if you enter a price.
Use **Edit** on an inventory row to update item details or manage store prices. **Save item** and **Save price** save their respective changes separately.

```
npm install
npm start          # builds the client and serves everything at http://localhost:3001
npm run dev        # server on 3001, Vite dev server with proxy on 5173
npm test           # unit tests
npm run test:e2e   # Playwright (run `npx playwright install chromium` once)
```

Data is stored in `grocery.db` at the project root, regardless of the server's working directory. Override with `DB_PATH` (relative paths use the working directory), port with `PORT`. See `PLAN.md`.

### Transfer existing groceries

Keep a SQLite backup, then create your account in the app. From the project root, run `npm run claim-legacy -- YOUR_USERNAME` and refresh. Use the same database as the running app (use an absolute `DB_PATH` if overriding it). The local command transfers only unassigned inventory, prices, and shopping lists. New accounts start empty; signing up never claims existing data.

The app listens on loopback for local use. For remote use, put the built app behind a local HTTPS reverse proxy that overwrites `X-Forwarded-Proto` and start with `HTTPS_PROXY_MODE=1`. Do not expose the development server.
