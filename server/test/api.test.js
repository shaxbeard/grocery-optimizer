import { beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { openDb } from '../src/db.js'

let api
beforeEach(() => {
  api = request(createApp(openDb(':memory:')))
})

const addItem = async (body = {}) =>
  (await api.post('/api/items').send({ name: 'Milk', category: 'dairy', quantity: 1, target: 3, ...body })).body

describe('items', () => {
  it('creates and lists items', async () => {
    const created = await api.post('/api/items').send({ name: ' Apples ', category: 'produce' })
    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({ name: 'Apples', quantity: 0, package_amount: null, prices: [], best: null })
    const list = await api.get('/api/items')
    expect(list.body).toHaveLength(1)
  })

  it('saves an optional initial price as a store price', async () => {
    const created = await api.post('/api/items').send({ name: 'Hummus', initial_price: { store: ' Aldi ', price: 0 } })
    expect(created.status).toBe(201)
    expect(created.body.best).toMatchObject({ store: 'Aldi', price: 0 })
    expect((await api.get('/api/items')).body[0].prices).toEqual([created.body.best])
  })

  it('does not create an item when its initial price is invalid', async () => {
    for (const [initial_price, error] of [
      [{ store: ' ', price: 3.5 }, 'store is required'],
      [{ store: 'Aldi', price: -1 }, 'price must be a non-negative number'],
    ]) {
      const res = await api.post('/api/items').send({ name: 'Hummus', initial_price })
      expect(res.status).toBe(400)
      expect(res.body.error).toBe(error)
    }
    expect((await api.get('/api/items')).body).toHaveLength(0)
  })

  it('filters by category', async () => {
    await addItem({ name: 'Milk' })
    await addItem({ name: 'Apples', category: 'produce' })
    const res = await api.get('/api/items?category=produce')
    expect(res.body.map((i) => i.name)).toEqual(['Apples'])
  })

  it('rejects invalid items', async () => {
    expect((await api.post('/api/items').send({ name: '  ' })).status).toBe(400)
    expect((await api.post('/api/items').send({ name: 'x', category: 'toys' })).status).toBe(400)
    expect((await api.post('/api/items').send({ name: 'x', quantity: -1 })).status).toBe(400)
  })

  it('marks items weekly with a per-week quantity', async () => {
    const item = await addItem()
    expect(item).toMatchObject({ weekly: 0, per_week: 0 })
    const updated = await api.put(`/api/items/${item.id}`).send({ weekly: true, per_week: 2 })
    expect(updated.body).toMatchObject({ name: 'Milk', weekly: 1, per_week: 2 })
    expect((await api.put(`/api/items/${item.id}`).send({ per_week: -1 })).status).toBe(400)
  })

  it('stores a max buy quantity', async () => {
    const item = await addItem()
    expect(item.max_buy).toBe(0)
    const updated = await api.put(`/api/items/${item.id}`).send({ max_buy: 12 })
    expect(updated.body.max_buy).toBe(12)
    expect((await api.put(`/api/items/${item.id}`).send({ max_buy: -1 })).status).toBe(400)
  })

  it('persists package size and unit through partial edits and lets the size be cleared', async () => {
    const item = await addItem({ package_amount: 500, package_unit: 'mL' })
    expect(item).toMatchObject({ package_amount: 500, package_unit: 'mL' })
    const url = `/api/items/${item.id}`
    expect((await api.put(url).send({ quantity: 2 })).body).toMatchObject({ package_amount: 500, package_unit: 'mL' })
    expect((await api.put(url).send({ package_amount: 0.5, package_unit: 'L' })).status).toBe(200)
    expect((await api.get('/api/items')).body[0]).toMatchObject({ package_amount: 0.5, package_unit: 'L' })
    expect((await api.put(url).send({ package_amount: null })).body.package_amount).toBeNull()
  })

  it('rejects invalid sizes, unsupported units, and fractional counts', async () => {
    const item = await addItem({ name: 'Tissues', package_amount: 6, package_unit: 'count' })
    expect(item).toMatchObject({ package_amount: 6, package_unit: 'count' })
    for (const fields of [
      { package_amount: 0 }, { package_amount: -1 }, { package_amount: '500' }, { package_amount: true },
      { package_unit: 'oz' }, { package_amount: 2.5, package_unit: 'count' },
    ]) {
      expect((await api.post('/api/items').send({ name: 'Tissues', ...fields })).status).toBe(400)
      expect((await api.put(`/api/items/${item.id}`).send(fields)).status).toBe(400)
    }
    expect((await api.get('/api/items')).body[0]).toMatchObject({ package_amount: 6, package_unit: 'count' })
  })

  it('preserves existing gram values and store prices when opening a legacy database', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'grocery-package-units-'))
    const path = join(dir, 'legacy.db')
    let db
    try {
      db = openDb(path)
      db.exec('ALTER TABLE items DROP COLUMN package_unit; ALTER TABLE items RENAME COLUMN package_amount TO package_grams')
      db.exec("INSERT INTO items (name, package_grams) VALUES ('Hummus', 500); INSERT INTO prices (item_id, store, price) VALUES (1, 'Market', 3.50)")
      db.close()
      db = openDb(path)
      const { body } = await request(createApp(db)).get('/api/items')
      expect(body[0]).toMatchObject({ name: 'Hummus', package_amount: 500, package_unit: 'g', best: { store: 'Market', price: 3.5 } })
    } finally {
      if (db?.open) db.close()
      rmSync(path, { force: true })
      rmdirSync(dir)
    }
  })

  it('updates partially and deletes', async () => {
    const item = await addItem()
    const updated = await api.put(`/api/items/${item.id}`).send({ quantity: 2 })
    expect(updated.body).toMatchObject({ name: 'Milk', quantity: 2, target: 3 })
    expect((await api.put('/api/items/999').send({ quantity: 2 })).status).toBe(404)
    expect((await api.put(`/api/items/${item.id}`).send({ quantity: 'a' })).status).toBe(400)
    expect((await api.delete(`/api/items/${item.id}`)).status).toBe(204)
    expect((await api.get('/api/items')).body).toHaveLength(0)
  })
})

describe('prices', () => {
  it('upserts store prices and reports the best', async () => {
    const item = await addItem()
    await api.put(`/api/items/${item.id}/prices`).send({ store: 'Aldi', price: 3.5 })
    await api.put(`/api/items/${item.id}/prices`).send({ store: 'Costco', price: 2.9 })
    const res = await api.put(`/api/items/${item.id}/prices`).send({ store: 'Aldi', price: 2.5 })
    expect(res.body.prices).toHaveLength(2)
    expect(res.body.best).toMatchObject({ store: 'Aldi', price: 2.5 })
  })

  it('validates and deletes prices', async () => {
    const item = await addItem()
    expect((await api.put(`/api/items/${item.id}/prices`).send({ store: '', price: 1 })).status).toBe(400)
    expect((await api.put(`/api/items/${item.id}/prices`).send({ store: 'A', price: -1 })).status).toBe(400)
    expect((await api.put('/api/items/999/prices').send({ store: 'A', price: 1 })).status).toBe(404)
    const { body } = await api.put(`/api/items/${item.id}/prices`).send({ store: 'A', price: 1 })
    await api.delete(`/api/prices/${body.prices[0].id}`)
    expect((await api.get('/api/items')).body[0].prices).toHaveLength(0)
  })

  it('removes prices when the item is deleted', async () => {
    const item = await addItem()
    await api.put(`/api/items/${item.id}/prices`).send({ store: 'A', price: 1 })
    await api.delete(`/api/items/${item.id}`)
    const other = await addItem({ name: 'Eggs' })
    expect((await api.get('/api/items')).body.find((i) => i.id === other.id).prices).toEqual([])
  })
})

describe('shopping lists', () => {
  it('creates, fetches, lists and deletes lists', async () => {
    const created = await api.post('/api/lists').send({ name: 'Weekly' })
    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({ name: 'Weekly', items: [] })
    expect((await api.post('/api/lists').send({ name: '' })).status).toBe(400)
    expect((await api.get('/api/lists')).body).toHaveLength(1)
    expect((await api.get('/api/lists/999')).status).toBe(404)
    await api.delete(`/api/lists/${created.body.id}`)
    expect((await api.get('/api/lists')).body).toHaveLength(0)
  })

  it('generates a list from low-stock items', async () => {
    await addItem({ name: 'Milk', quantity: 1, target: 3 })
    await addItem({ name: 'Rice', category: 'pantry', quantity: 5, target: 2 })
    const res = await api.post('/api/lists/from-inventory')
    expect(res.status).toBe(201)
    expect(res.body.items).toHaveLength(1)
    expect(res.body.items[0]).toMatchObject({ name: 'Milk', list_quantity: 2, purchased: false })
  })

  it('adds and removes list items', async () => {
    const item = await addItem()
    const list = (await api.post('/api/lists').send({ name: 'L' })).body
    const added = await api.post(`/api/lists/${list.id}/items`).send({ item_id: item.id, quantity: 4 })
    expect(added.body.items[0].list_quantity).toBe(4)
    expect((await api.post(`/api/lists/${list.id}/items`).send({ item_id: 999 })).status).toBe(400)
    expect((await api.post(`/api/lists/${list.id}/items`).send({ item_id: item.id, quantity: 0 })).status).toBe(400)
    expect((await api.post('/api/lists/999/items').send({ item_id: item.id })).status).toBe(404)
    await api.delete(`/api/list-items/${added.body.items[0].list_item_id}`)
    expect((await api.get(`/api/lists/${list.id}`)).body.items).toHaveLength(0)
  })

  it('updates inventory when marking purchased and reverts when unmarked', async () => {
    const item = await addItem({ quantity: 1, target: 3 })
    const list = (await api.post('/api/lists/from-inventory')).body
    const liId = list.items[0].list_item_id

    const bought = await api.put(`/api/list-items/${liId}/purchased`).send({ purchased: true })
    expect(bought.body.items[0]).toMatchObject({ purchased: true, quantity: 3 })
    await api.put(`/api/list-items/${liId}/purchased`).send({ purchased: true })
    expect((await api.get('/api/items')).body[0].quantity).toBe(3)

    await api.put(`/api/list-items/${liId}/purchased`).send({ purchased: false })
    expect((await api.get('/api/items')).body[0]).toMatchObject({ id: item.id, quantity: 1 })
    expect((await api.put('/api/list-items/999/purchased').send({ purchased: true })).status).toBe(404)
  })
})
