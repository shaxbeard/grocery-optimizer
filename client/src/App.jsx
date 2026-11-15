import { useEffect, useState } from 'react'
import { api } from './api'
import Onboarding from './Onboarding'
import Dashboard from './Dashboard'
import Lists from './Lists'

export default function App() {
  const [items, setItems] = useState(null)
  const [tab, setTab] = useState('dashboard')

  const refresh = () => api.items().then(setItems)
  useEffect(() => {
    refresh()
  }, [])

  if (!items) return null

  return (
    <div className="app">
      <header>
        <h1>Grocery Manager</h1>
        {items.length > 0 && (
          <nav>
            <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => setTab('dashboard')}>
              Inventory
            </button>
            <button className={tab === 'lists' ? 'active' : ''} onClick={() => setTab('lists')}>
              Shopping Lists
            </button>
          </nav>
        )}
      </header>
      {items.length === 0 ? (
        <Onboarding onDone={refresh} />
      ) : tab === 'dashboard' ? (
        <Dashboard items={items} refresh={refresh} />
      ) : (
        <Lists items={items} refresh={refresh} />
      )}
    </div>
  )
}
