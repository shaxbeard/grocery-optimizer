import { useEffect, useState } from 'react'
import { api, money } from './api'

export default function Lists({ items, refresh }) {
  const [lists, setLists] = useState([])
  const [list, setList] = useState(null)
  const [name, setName] = useState('')
  const [add, setAdd] = useState({ item_id: '', quantity: 1 })

  const load = async (id = list?.id) => {
    const all = await api.lists()
    setLists(all)
    const current = all.find((l) => l.id === Number(id)) ?? all[0]
    setList(current ? await api.list(current.id) : null)
  }
  useEffect(() => {
    load()
  }, [])

  async function create(fn, ...args) {
    const created = await fn(...args)
    setName('')
    load(created.id)
  }

  async function toggle(li) {
    await api.setPurchased(li.list_item_id, !li.purchased)
    await load()
    refresh()
  }

  async function addItem(e) {
    e.preventDefault()
    await api.addListItem(list.id, Number(add.item_id), Number(add.quantity))
    setAdd({ item_id: '', quantity: 1 })
    load()
  }

  const estimate = list?.items.reduce((sum, i) => sum + (i.best ? i.best.price * i.list_quantity : 0), 0) ?? 0

  return (
    <>
      <div className="card inline">
        <button className="primary" onClick={() => create(api.generateList)}>
          Generate from inventory
        </button>
        <form
          className="inline"
          onSubmit={(e) => {
            e.preventDefault()
            create(api.addList, name)
          }}
        >
          <input aria-label="New list name" placeholder="New list name" value={name} onChange={(e) => setName(e.target.value)} required />
          <button>Create list</button>
        </form>
        {lists.length > 0 && (
          <select aria-label="Select list" value={list?.id ?? ''} onChange={(e) => load(e.target.value)}>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {list && (
        <div className="card">
          <div className="list-head">
            <h2>{list.name}</h2>
            <span className="muted">Estimated total: {money(estimate)}</span>
            <button className="link danger" onClick={() => api.deleteList(list.id).then(() => load())}>
              Delete list
            </button>
          </div>
          {list.items.length === 0 && <p className="muted">This list is empty.</p>}
          <ul className="checklist">
            {list.items.map((li) => (
              <li key={li.list_item_id} className={li.purchased ? 'done' : ''}>
                <label>
                  <input type="checkbox" checked={li.purchased} onChange={() => toggle(li)} />
                  {li.name} <span className="muted">x {li.list_quantity} {li.unit}</span>
                </label>
                <span className="muted">{li.best ? `${money(li.best.price)} at ${li.best.store}` : ''}</span>
                <button className="link" aria-label={`Remove ${li.name} from list`} onClick={() => api.deleteListItem(li.list_item_id).then(() => load())}>
                  remove
                </button>
              </li>
            ))}
          </ul>
          <form className="inline" onSubmit={addItem}>
            <select aria-label="Item to add" value={add.item_id} onChange={(e) => setAdd({ ...add, item_id: e.target.value })} required>
              <option value="">Add an item...</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
            <input aria-label="Quantity" type="number" min="1" step="any" value={add.quantity} onChange={(e) => setAdd({ ...add, quantity: e.target.value })} />
            <button>Add to list</button>
          </form>
        </div>
      )}
    </>
  )
}
