import express from 'express'
import { PACKAGE_UNITS } from '../../shared/packageUnits.js'
import { installAuth } from './auth.js'

export const CATEGORIES = ['produce', 'fridge', 'meat', 'pantry', 'freezer', 'household']

const isNum = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0
const bad = (res, message) => res.status(400).json({ error: message })

function parsePrice(body) {
  const store = typeof body?.store === 'string' ? body.store.trim() : ''
  if (!store) return 'store is required'
  if (!isNum(body.price)) return 'price must be a non-negative number'
  return { store, price: body.price }
}

export function createApp(db, { behindHttpsProxy = false } = {}) {
  const app = express()
  if (behindHttpsProxy) {
    app.set('trust proxy', 'loopback')
    app.use((req, res, next) => {
      if (!req.secure) return res.status(403).json({ error: 'HTTPS is required' })
      next()
    })
  }
  app.use(express.json())
  installAuth(app, db)

  const getItem = (id, userId) => db.prepare('SELECT * FROM items WHERE id = ? AND user_id = ?').get(id, userId)

  function withPrices(items, userId) {
    const prices = db.prepare('SELECT p.* FROM prices p JOIN items i ON i.id = p.item_id WHERE i.user_id = ? ORDER BY p.price').all(userId)
    return items.map((item) => {
      const itemPrices = prices.filter((p) => p.item_id === item.id)
      return { ...item, prices: itemPrices, best: itemPrices[0] ?? null }
    })
  }

  function parseItem(body, existing = {}) {
    const item = { name: '', category: 'pantry', unit: '', quantity: 0, target: 0, weekly: 0, per_week: 0, max_buy: 0, package_amount: null, package_unit: 'g', ...existing, ...body }
    item.name = String(item.name).trim()
    if (!item.name) return 'name is required'
    if (!CATEGORIES.includes(item.category)) return 'invalid category'
    if (!isNum(item.quantity) || !isNum(item.target) || !isNum(item.per_week) || !isNum(item.max_buy)) {
      return 'quantity, target, per_week and max_buy must be non-negative numbers'
    }
    if (typeof item.package_unit !== 'string' || !Object.hasOwn(PACKAGE_UNITS, item.package_unit)) {
      return 'Package unit must be grams, millilitres, litres or count'
    }
    if (item.package_amount !== null) {
      if (!isNum(item.package_amount) || item.package_amount === 0) {
        return 'Package size must be a positive number or left blank'
      }
      if (item.package_unit === 'count' && !Number.isSafeInteger(item.package_amount)) {
        return 'Package count must be a whole number'
      }
    }
    item.weekly = item.weekly ? 1 : 0
    return item
  }

  const insertItem = db.prepare(
    'INSERT INTO items (name, category, unit, quantity, target, weekly, per_week, max_buy, package_amount, package_unit, user_id) VALUES (@name, @category, @unit, @quantity, @target, @weekly, @per_week, @max_buy, @package_amount, @package_unit, @user_id)'
  )
  const upsertPrice = db.prepare(
    `INSERT INTO prices (item_id, store, price) VALUES (?, ?, ?)
     ON CONFLICT (item_id, store) DO UPDATE SET price = excluded.price, updated_at = CURRENT_TIMESTAMP`
  )
  const createItem = db.transaction((item, initialPrice) => {
    const { lastInsertRowid } = insertItem.run(item)
    if (initialPrice) upsertPrice.run(lastInsertRowid, initialPrice.store, initialPrice.price)
    return getItem(lastInsertRowid, item.user_id)
  })

  // Items
  app.get('/api/items', (req, res) => {
    const { category } = req.query
    const items = category
      ? db.prepare('SELECT * FROM items WHERE user_id = ? AND category = ? ORDER BY name').all(req.userId, category)
      : db.prepare('SELECT * FROM items WHERE user_id = ? ORDER BY name').all(req.userId)
    res.json(withPrices(items, req.userId))
  })

  app.post('/api/items', (req, res) => {
    const { initial_price, ...fields } = req.body ?? {}
    const item = parseItem(fields)
    if (typeof item === 'string') return bad(res, item)
    const initialPrice = initial_price === undefined ? null : parsePrice(initial_price)
    if (typeof initialPrice === 'string') return bad(res, initialPrice)
    res.status(201).json(withPrices([createItem({ ...item, user_id: req.userId }, initialPrice)], req.userId)[0])
  })

  app.put('/api/items/:id', (req, res) => {
    const existing = getItem(req.params.id, req.userId)
    if (!existing) return res.status(404).json({ error: 'not found' })
    const item = parseItem(req.body, existing)
    if (typeof item === 'string') return bad(res, item)
    db.prepare(
      'UPDATE items SET name = @name, category = @category, unit = @unit, quantity = @quantity, target = @target, weekly = @weekly, per_week = @per_week, max_buy = @max_buy, package_amount = @package_amount, package_unit = @package_unit WHERE id = @id AND user_id = @user_id'
    ).run({ ...item, id: existing.id, user_id: req.userId })
    res.json(withPrices([getItem(existing.id, req.userId)], req.userId)[0])
  })

  app.delete('/api/items/:id', (req, res) => {
    db.prepare('DELETE FROM items WHERE id = ? AND user_id = ?').run(req.params.id, req.userId)
    res.status(204).end()
  })

  // Prices
  app.put('/api/items/:id/prices', (req, res) => {
    const item = getItem(req.params.id, req.userId)
    if (!item) return res.status(404).json({ error: 'not found' })
    const price = parsePrice(req.body)
    if (typeof price === 'string') return bad(res, price)
    upsertPrice.run(item.id, price.store, price.price)
    res.json(withPrices([item], req.userId)[0])
  })

  app.delete('/api/prices/:id', (req, res) => {
    db.prepare('DELETE FROM prices WHERE id = ? AND item_id IN (SELECT id FROM items WHERE user_id = ?)').run(req.params.id, req.userId)
    res.status(204).end()
  })

  // Shopping lists
  const listWithItems = (list) => ({
    ...list,
    items: withPrices(
      db
        .prepare(
          `SELECT li.id AS list_item_id, li.quantity AS list_quantity, li.purchased, i.*
           FROM list_items li JOIN items i ON i.id = li.item_id
           WHERE li.list_id = ? AND i.user_id = ? ORDER BY i.category, i.name`
        )
        .all(list.id, list.user_id)
        .map((r) => ({ ...r, purchased: Boolean(r.purchased) })),
      list.user_id,
    ),
  })
  const getList = (id, userId) => db.prepare('SELECT * FROM lists WHERE id = ? AND user_id = ?').get(id, userId)
  const insertList = db.prepare('INSERT INTO lists (name, user_id) VALUES (?, ?)')
  const ownedListItems = `SELECT li.id FROM list_items li
    JOIN lists l ON l.id = li.list_id JOIN items i ON i.id = li.item_id
    WHERE l.user_id = ? AND i.user_id = ?`

  app.get('/api/lists', (req, res) => {
    res.json(db.prepare('SELECT * FROM lists WHERE user_id = ? ORDER BY id DESC').all(req.userId))
  })

  app.get('/api/lists/:id', (req, res) => {
    const list = getList(req.params.id, req.userId)
    if (!list) return res.status(404).json({ error: 'not found' })
    res.json(listWithItems(list))
  })

  app.post('/api/lists', (req, res) => {
    const name = String(req.body.name ?? '').trim()
    if (!name) return bad(res, 'name is required')
    const { lastInsertRowid } = insertList.run(name, req.userId)
    res.status(201).json(listWithItems(getList(lastInsertRowid, req.userId)))
  })

  app.post('/api/lists/from-inventory', (req, res) => {
    const name = `Shopping list ${new Date().toISOString().slice(0, 10)}`
    const list = db.transaction(() => {
      const { lastInsertRowid } = insertList.run(name, req.userId)
      db.prepare(
        `INSERT INTO list_items (list_id, item_id, quantity)
         SELECT ?, id, target - quantity FROM items WHERE quantity < target AND user_id = ?`
      ).run(lastInsertRowid, req.userId)
      return getList(lastInsertRowid, req.userId)
    })()
    res.status(201).json(listWithItems(list))
  })

  app.delete('/api/lists/:id', (req, res) => {
    db.prepare('DELETE FROM lists WHERE id = ? AND user_id = ?').run(req.params.id, req.userId)
    res.status(204).end()
  })

  app.post('/api/lists/:id/items', (req, res) => {
    const list = getList(req.params.id, req.userId)
    if (!list) return res.status(404).json({ error: 'not found' })
    const { item_id, quantity = 1 } = req.body
    if (!Number.isSafeInteger(item_id) || !getItem(item_id, req.userId)) return bad(res, 'unknown item')
    if (!isNum(quantity) || quantity === 0) return bad(res, 'quantity must be positive')
    db.prepare(
      `INSERT INTO list_items (list_id, item_id, quantity) VALUES (?, ?, ?)
       ON CONFLICT (list_id, item_id) DO UPDATE SET quantity = excluded.quantity`
    ).run(list.id, item_id, quantity)
    res.status(201).json(listWithItems(list))
  })

  app.delete('/api/list-items/:id', (req, res) => {
    db.prepare(`DELETE FROM list_items WHERE id = ? AND id IN (${ownedListItems})`).run(req.params.id, req.userId, req.userId)
    res.status(204).end()
  })

  app.put('/api/list-items/:id/purchased', (req, res) => {
    const purchased = req.body.purchased ? 1 : 0
    const list = db.transaction(() => {
      const li = db.prepare(`SELECT * FROM list_items WHERE id = ? AND id IN (${ownedListItems})`).get(req.params.id, req.userId, req.userId)
      if (!li) return null
      if (purchased !== li.purchased) {
        const delta = purchased ? li.quantity : -li.quantity
        db.prepare('UPDATE items SET quantity = MAX(0, quantity + ?) WHERE id = ? AND user_id = ?').run(delta, li.item_id, req.userId)
        db.prepare('UPDATE list_items SET purchased = ? WHERE id = ?').run(purchased, li.id)
      }
      return getList(li.list_id, req.userId)
    })()
    if (!list) return res.status(404).json({ error: 'not found' })
    res.json(listWithItems(list))
  })

  app.use((err, req, res, next) => {
    const status = err.status === 400 || err.status === 413 ? err.status : 500
    if (status === 500) console.error('Unexpected API error:', err.code ?? err.name)
    res.status(status).json({ error: status === 500 ? 'Something went wrong' : 'Invalid request body' })
  })

  return app
}
