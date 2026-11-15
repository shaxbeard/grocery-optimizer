import { useState } from 'react'
import { api, CATEGORIES } from './api'

export function parseLines(text) {
  return text
    .split('\n')
    .map((line) => line.split(',').map((s) => s.trim()))
    .filter(([name]) => name)
    .map(([name, category]) => ({
      name,
      category: CATEGORIES.includes(category?.toLowerCase()) ? category.toLowerCase() : 'pantry',
    }))
}

export default function Onboarding({ onDone }) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const items = parseLines(text)

  async function submit(e) {
    e.preventDefault()
    try {
      await api.bulkItems(items)
      onDone()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>Welcome! Let's set up your groceries</h2>
      <p className="muted">
        Enter one item per line, optionally followed by a category ({CATEGORIES.join(', ')}). Example: <code>Milk, dairy</code>
      </p>
      <textarea
        aria-label="Grocery items"
        rows={12}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'Bananas, produce\nMilk, dairy\nRice, pantry'}
      />
      {error && <p className="error">{error}</p>}
      <button className="primary" disabled={items.length === 0}>
        Add {items.length} {items.length === 1 ? 'item' : 'items'}
      </button>
    </form>
  )
}
