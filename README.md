# Grocery Manager

Track groceries, store prices, inventory and shopping lists.

```
npm install
npm start          # builds the client and serves everything at http://localhost:3001
npm run dev        # server on 3001, Vite dev server with proxy on 5173
npm test           # unit tests
npm run test:e2e   # Playwright (run `npx playwright install chromium` once)
```

Data is stored in `grocery.db` (override with `DB_PATH`, port with `PORT`). See `PLAN.md`.
