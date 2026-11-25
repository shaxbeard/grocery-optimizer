import { Fragment, useState } from 'react'
import { PACKAGE_UNITS } from '../../shared/packageUnits.js'
import { api, CATEGORIES, money } from './api'

function UnitPrice({ price, item }) {
  if (item.package_amount == null) return null
  const { rateAmount, rateLabel } = PACKAGE_UNITS[item.package_unit]
  const rate = price / (item.package_amount / rateAmount)
  return <span className="muted">{Number.isFinite(rate) ? `${money(rate)} ${rateLabel}` : 'Unit price out of range'}</span>
}

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
      <strong>Store prices</strong>
      {item.prices.map((p) => (
        <div key={p.id} className="price-row">
          <span>{p.store}</span>
          <strong>{money(p.price)}</strong>
          <UnitPrice price={p.price} item={item} />
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

function PackageSizeInput({ size, onChange, form }) {
  return (
    <div className="inline">
      <label className="inline">
        Package size
        <input
          form={form}
          aria-label={form ? 'Edit package size' : 'Package size, optional'}
          className="package-size"
          placeholder="Optional"
          type="number"
          min={size.package_unit === 'count' ? '1' : '0'}
          step={size.package_unit === 'count' ? '1' : 'any'}
          value={size.package_amount}
          onChange={(e) => onChange({ ...size, package_amount: e.target.value })}
        />
      </label>
      <select
        form={form}
        aria-label={form ? 'Edit package unit' : 'Package unit'}
        value={size.package_unit}
        onChange={(e) => onChange({ ...size, package_unit: e.target.value })}
      >
        {Object.entries(PACKAGE_UNITS).map(([unit, { label }]) => <option key={unit} value={unit}>{label}</option>)}
      </select>
    </div>
  )
}

const packageAmount = (size) => size === '' ? null : Number(size)

export function AddItemForm({ refresh }) {
  const [expanded, setExpanded] = useState(false)
  const [form, setForm] = useState({ name: '', category: 'produce', package_amount: '', package_unit: 'g' })
  const [price, setPrice] = useState('')
  const [store, setStore] = useState('')
  const [error, setError] = useState('')
  const hasPrice = price !== ''

  async function add(e) {
    e.preventDefault()
    setError('')
    try {
      const item = { ...form, package_amount: packageAmount(form.package_amount) }
      if (hasPrice) item.initial_price = { store: store.trim(), price: Number(price) }
      await api.addItem(item)
    } catch (err) {
      setError(err.message)
      return
    }
    setForm({ ...form, name: '', package_amount: '', package_unit: 'g' })
    setPrice('')
    setStore('')
    refresh()
  }

  if (!expanded) {
    return (
      <div className="card">
        <button type="button" className="primary" onClick={() => setExpanded(true)}>Add new item</button>
      </div>
    )
  }

  return (
    <form className="card inline" onSubmit={add}>
      <input aria-label="New item name" placeholder="New item" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      <select aria-label="New item category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
        {CATEGORIES.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
      <PackageSizeInput size={form} onChange={setForm} />
      <input
        aria-label="Package price (optional)"
        placeholder="Package price (optional)"
        type="number"
        min="0"
        step="0.01"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
      />
      <input
        aria-label="Store (required with price)"
        placeholder="Store (required with price)"
        value={store}
        onChange={(e) => setStore(e.target.value)}
        required={hasPrice}
      />
      <button className="primary">Add item</button>
      {error && <span role="alert" className="error">{error}</span>}
    </form>
  )
}

function EditCells({ item, refresh, onDone }) {
  const [form, setForm] = useState({ name: item.name, category: item.category, package_amount: item.package_amount ?? '', package_unit: item.package_unit ?? 'g' })
  const [error, setError] = useState('')
  const id = `edit-${item.id}`

  async function save(e) {
    e.preventDefault()
    setError('')
    try {
      await api.updateItem(item.id, { ...form, package_amount: packageAmount(form.package_amount) })
    } catch (err) {
      setError(err.message)
      return
    }
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
      <td colSpan={5}>
        <PackageSizeInput form={id} size={form} onChange={setForm} />
        {error && <div role="alert" className="error">{error}</div>}
      </td>
      <td>
        <button form={id} className="link">Save item</button>
        <button type="button" className="link" onClick={onDone}>Cancel</button>
      </td>
    </>
  )
}

export default function Dashboard({ items, refresh }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [editing, setEditing] = useState(null)
  const [weeklyOnly, setWeeklyOnly] = useState(false)

  const query = search.trim().toLowerCase()
  const shown = items.filter((item) =>
    (filter === 'all' || item.category === filter) &&
    (!weeklyOnly || item.weekly) &&
    item.name.toLowerCase().includes(query)
  )

  return (
    <>
      <div className="filters">
        <label className="inline">
          Search items
          <input type="search" placeholder="Item name" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
      </div>
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
            <th>Weekly</th>
            <th>Item</th>
            <th>Category</th>
            <th>Have</th>
            <th>Want</th>
            <th>Per week</th>
            <th>Max buy</th>
            <th>Best price</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {shown.length === 0 && (
            <tr><td colSpan={9} className="muted">No items match your filters.</td></tr>
          )}
          {shown.map((item) => (
            <Fragment key={item.id}>
              <tr className={item.quantity < item.target ? 'low' : ''}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`${item.name} weekly`}
                    checked={Boolean(item.weekly)}
                    onChange={(e) => api.updateItem(item.id, { weekly: e.target.checked }).then(refresh)}
                  />
                </td>
                {editing === item.id ? (
                  <EditCells item={item} refresh={refresh} onDone={() => setEditing(null)} />
                ) : (
                  <>
                <td>
                  {item.name}
                  {item.package_amount != null && (
                    <div className="muted">
                      {item.package_unit === 'count'
                        ? `${item.package_amount}-pack`
                        : `${item.package_amount} ${item.package_unit}`}
                    </div>
                  )}
                </td>
                <td className="muted">{item.category}</td>
                <td><NumberCell item={item} field="quantity" refresh={refresh} /></td>
                <td><NumberCell item={item} field="target" refresh={refresh} /></td>
                <td><NumberCell item={item} field="per_week" label="per week" refresh={refresh} /></td>
                <td><NumberCell item={item} field="max_buy" label="max buy" refresh={refresh} /></td>
                <td>
                  {item.best ? (
                    <>
                      {`${money(item.best.price)} at ${item.best.store}`}
                      {item.package_amount != null && (
                        <div><UnitPrice price={item.best.price} item={item} /></div>
                      )}
                    </>
                  ) : <span className="muted">-</span>}
                </td>
                <td>
                  <button className="link" onClick={() => setEditing(item.id)}>Edit</button>
                  <button className="link danger" onClick={() => api.deleteItem(item.id).then(refresh)}>Delete</button>
                </td>
                  </>
                )}
              </tr>
              {editing === item.id && (
                <tr>
                  <td colSpan={9}>
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
