import { Fragment, useState } from 'react'
import { api, CATEGORIES, money } from './api'

function Prices({ item, refresh }) {
  const [store, setStore] = useState('')
  const [price, setPrice] = useState('')

  async function save(e) {
    e.preventDefault()
    await api.setPrice(item.id, store, Number(price))
    setStore('')
    setPrice('')
    refresh()
  }

  return (
    <div className="prices">
      {item.prices.map((p) => (
        <div key={p.id} className="price-row">
          <span>{p.store}</span>
          <strong>{money(p.price)}</strong>
          <button className="link" aria-label={`Remove ${p.store} price`} onClick={() => api.deletePrice(p.id).then(refresh)}>
            remove
          </button>
        </div>
      ))}
      <form onSubmit={save} className="inline">
        <input aria-label="Store" placeholder="Store" value={store} onChange={(e) => setStore(e.target.value)} required />
        <input
          aria-label="Price"
          type="number"
          step="0.01"
          min="0"
          placeholder="Price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
        />
        <button className="primary">Save price</button>
      </form>
    </div>
  )
}

function NumberCell({ item, field, label = field, refresh }) {
  return (
    <input
      type="number"
      min="0"
      step="any"
      aria-label={`${item.name} ${label}`}
      defaultValue={item[field]}
      key={item[field]}
      onBlur={(e) => {
        const value = Number(e.target.value)
        if (value !== item[field] && e.target.value !== '') api.updateItem(item.id, { [field]: value }).then(refresh)
      }}
    />
  )
}

export function AddItemForm({ refresh }) {
  const [form, setForm] = useState({ name: '', category: 'produce' })

  async function add(e) {
    e.preventDefault()
    await api.addItem(form)
    setForm({ ...form, name: '' })
    refresh()
  }

  return (
    <form className="card inline" onSubmit={add}>
      <input aria-label="New item name" placeholder="New item" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      <select aria-label="New item category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
        {CATEGORIES.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
      <button className="primary">Add item</button>
    </form>
  )
}

function EditCells({ item, refresh, onDone }) {
  const [form, setForm] = useState({ name: item.name, category: item.category })
  const id = `edit-${item.id}`

  async function save(e) {
    e.preventDefault()
    await api.updateItem(item.id, form)
    onDone()
    refresh()
  }

  return (
    <>
      <td>
        <input form={id} aria-label="Edit name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </td>
      <td>
        <select form={id} aria-label="Edit category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <form id={id} onSubmit={save} />
      </td>
      <td colSpan={5}></td>
      <td>
        <button form={id} className="link">Save</button>
        <button type="button" className="link" onClick={onDone}>Cancel</button>
      </td>
    </>
  )
}

export default function Dashboard({ items, refresh }) {
  const [filter, setFilter] = useState('all')
  const [open, setOpen] = useState(null)
  const [editing, setEditing] = useState(null)
  const [weeklyOnly, setWeeklyOnly] = useState(false)

  const shown = items.filter((i) => (filter === 'all' || i.category === filter) && (!weeklyOnly || i.weekly))

  return (
    <>
      <div className="filters" role="group" aria-label="Category filter">
        {['all', ...CATEGORIES].map((c) => (
          <button key={c} className={filter === c ? 'chip active' : 'chip'} onClick={() => setFilter(c)}>
            {c}
          </button>
        ))}
      </div>
      <div className="filters" role="group" aria-label="View">
        <button className={weeklyOnly ? 'chip' : 'chip active'} onClick={() => setWeeklyOnly(false)}>
          all items
        </button>
        <button className={weeklyOnly ? 'chip active' : 'chip'} onClick={() => setWeeklyOnly(true)}>
          weekly purchases
        </button>
      </div>

      <AddItemForm refresh={refresh} />

      <table className="card">
        <thead>
          <tr>
            <th>Item</th>
            <th>Category</th>
            <th>Have</th>
            <th>Want</th>
            <th>Weekly</th>
            <th>Per week</th>
            <th>Best price</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {shown.map((item) => (
            <Fragment key={item.id}>
              <tr className={item.quantity < item.target ? 'low' : ''}>
                {editing === item.id ? (
                  <EditCells item={item} refresh={refresh} onDone={() => setEditing(null)} />
                ) : (
                  <>
                <td>{item.name}</td>
                <td className="muted">{item.category}</td>
                <td><NumberCell item={item} field="quantity" refresh={refresh} /></td>
                <td><NumberCell item={item} field="target" refresh={refresh} /></td>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`${item.name} weekly`}
                    checked={Boolean(item.weekly)}
                    onChange={(e) => api.updateItem(item.id, { weekly: e.target.checked }).then(refresh)}
                  />
                </td>
                <td>{item.weekly ? <NumberCell item={item} field="per_week" label="per week" refresh={refresh} /> : null}</td>
                <td>{item.best ? `${money(item.best.price)} at ${item.best.store}` : <span className="muted">-</span>}</td>
                <td>
                  <button className="link" onClick={() => setOpen(open === item.id ? null : item.id)}>
                    {open === item.id ? 'Close' : 'Prices'}
                  </button>
                  <button className="link" onClick={() => setEditing(item.id)}>Edit</button>
                  <button className="link danger" onClick={() => api.deleteItem(item.id).then(refresh)}>Delete</button>
                </td>
                  </>
                )}
              </tr>
              {open === item.id && (
                <tr>
                  <td colSpan={8}>
                    <Prices item={item} refresh={refresh} />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </>
  )
}
