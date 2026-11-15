import express from 'express'

export const CATEGORIES = ['produce', 'dairy', 'meat', 'pantry', 'freezer', 'household']

const isNum = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0
const bad = (res, message) => res.status(400).json({ error: message })

export function createApp(db) {
  const app = express()
  app.use(express.json())

  const getItem = (id) => db.prepare('SELECT * FROM items WHERE id = ?').get(id)

  function withPrices(items) {
    const prices = db.prepare('SELECT * FROM prices ORDER BY price').all()
    return items.map((item) => {
      const itemPrices = prices.filter((p) => p.item_id === item.id)
      return { ...item, prices: itemPrices, best: itemPrices[0] ?? null }
    })
  }

  function parseItem(body, existing = {}) {
    const item = { name: '', category: 'pantry', unit: '', quantity: 0, target: 0, ...existing, ...body }
    item.name = String(item.name).trim()
    if (!item.name) return 'name is required'
    if (!CATEGORIES.includes(item.category)) return 'invalid category'
    if (!isNum(item.quantity) || !isNum(item.target)) return 'quantity and target must be non-negative numbers'
    return item
  }

  const insertItem = db.prepare(
    'INSERT INTO items (name, category, unit, quantity, target) VALUES (@name, @category, @unit, @quantity, @target)'
  )

  // Items
  app.get('/api/items', (req, res) => {
    const { category } = req.query
    const items = category
      ? db.prepare('SELECT * FROM items WHERE category = ? ORDER BY name').all(category)
      : db.prepare('SELECT * FROM items ORDER BY name').all()
    res.json(withPrices(items))
  })

  app.post('/api/items', (req, res) => {
    const item = parseItem(req.body)
    if (typeof item === 'string') return bad(res, item)
    const { lastInsertRowid } = insertItem.run(item)
    res.status(201).json(withPrices([getItem(lastInsertRowid)])[0])
  })

  app.put('/api/items/:id', (req, res) => {
    const existing = getItem(req.params.id)
    if (!existing) return res.status(404).json({ error: 'not found' })
    const item = parseItem(req.body, existing)
    if (typeof item === 'string') return bad(res, item)
    db.prepare(
      'UPDATE items SET name = @name, category = @category, unit = @unit, quantity = @quantity, target = @target WHERE id = @id'
    ).run({ ...item, id: existing.id })
    res.json(withPrices([getItem(existing.id)])[0])
  })

  app.delete('/api/items/:id', (req, res) => {
    db.prepare('DELETE FROM items WHERE id = ?').run(req.params.id)
    res.status(204).end()
  })

  // Prices
  app.put('/api/items/:id/prices', (req, res) => {
    const item = getItem(req.params.id)
    if (!item) return res.status(404).json({ error: 'not found' })
    const store = String(req.body.store ?? '').trim()
    const { price } = req.body
    if (!store) return bad(res, 'store is required')
    if (!isNum(price)) return bad(res, 'price must be a non-negative number')
    db.prepare(
      `INSERT INTO prices (item_id, store, price) VALUES (?, ?, ?)
       ON CONFLICT (item_id, store) DO UPDATE SET price = excluded.price, updated_at = CURRENT_TIMESTAMP`
    ).run(item.id, store, price)
    res.json(withPrices([item])[0])
  })

  app.delete('/api/prices/:id', (req, res) => {
    db.prepare('DELETE FROM prices WHERE id = ?').run(req.params.id)
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
           WHERE li.list_id = ? ORDER BY i.category, i.name`
        )
        .all(list.id)
        .map((r) => ({ ...r, purchased: Boolean(r.purchased) }))
    ),
  })
  const getList = (id) => db.prepare('SELECT * FROM lists WHERE id = ?').get(id)

  app.get('/api/lists', (req, res) => {
    res.json(db.prepare('SELECT * FROM lists ORDER BY id DESC').all())
  })

  app.get('/api/lists/:id', (req, res) => {
    const list = getList(req.params.id)
    if (!list) return res.status(404).json({ error: 'not found' })
    res.json(listWithItems(list))
  })

  app.post('/api/lists', (req, res) => {
    const name = String(req.body.name ?? '').trim()
    if (!name) return bad(res, 'name is required')
    const { lastInsertRowid } = db.prepare('INSERT INTO lists (name) VALUES (?)').run(name)
    res.status(201).json(listWithItems(getList(lastInsertRowid)))
  })

  app.post('/api/lists/from-inventory', (req, res) => {
    const name = `Shopping list ${new Date().toISOString().slice(0, 10)}`
    const list = db.transaction(() => {
      const { lastInsertRowid } = db.prepare('INSERT INTO lists (name) VALUES (?)').run(name)
      db.prepare(
        `INSERT INTO list_items (list_id, item_id, quantity)
         SELECT ?, id, target - quantity FROM items WHERE quantity < target`
      ).run(lastInsertRowid)
      return getList(lastInsertRowid)
    })()
    res.status(201).json(listWithItems(list))
  })

  app.delete('/api/lists/:id', (req, res) => {
    db.prepare('DELETE FROM lists WHERE id = ?').run(req.params.id)
    res.status(204).end()
  })

  app.post('/api/lists/:id/items', (req, res) => {
    const list = getList(req.params.id)
    if (!list) return res.status(404).json({ error: 'not found' })
    const { item_id, quantity = 1 } = req.body
    if (!getItem(item_id)) return bad(res, 'unknown item')
    if (!isNum(quantity) || quantity === 0) return bad(res, 'quantity must be positive')
    db.prepare(
      `INSERT INTO list_items (list_id, item_id, quantity) VALUES (?, ?, ?)
       ON CONFLICT (list_id, item_id) DO UPDATE SET quantity = excluded.quantity`
    ).run(list.id, item_id, quantity)
    res.status(201).json(listWithItems(list))
  })

  app.delete('/api/list-items/:id', (req, res) => {
    db.prepare('DELETE FROM list_items WHERE id = ?').run(req.params.id)
    res.status(204).end()
  })

  app.put('/api/list-items/:id/purchased', (req, res) => {
    const li = db.prepare('SELECT * FROM list_items WHERE id = ?').get(req.params.id)
    if (!li) return res.status(404).json({ error: 'not found' })
    const purchased = req.body.purchased ? 1 : 0
    db.transaction(() => {
      if (purchased !== li.purchased) {
        const delta = purchased ? li.quantity : -li.quantity
        db.prepare('UPDATE items SET quantity = MAX(0, quantity + ?) WHERE id = ?').run(delta, li.item_id)
        db.prepare('UPDATE list_items SET purchased = ? WHERE id = ?').run(purchased, li.id)
      }
    })()
    res.json(listWithItems(getList(li.list_id)))
  })

  app.use((err, req, res, next) => {
    res.status(500).json({ error: err.message })
  })

  return app
}
