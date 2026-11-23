# Grocery Manager

Track groceries, store prices, inventory and shopping lists.

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
