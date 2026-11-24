import { useEffect, useState } from 'react'
import { api } from './api'
import Onboarding from './Onboarding'
import Dashboard from './Dashboard'
import Lists from './Lists'

function SignIn({ onSignedIn }) {
  const [signup, setSignup] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    setPending(true)
    setError('')
    try {
      const { user } = await (signup ? api.signup : api.login)({
        username: fields.get('username'),
        password: fields.get('password'),
      })
      onSignedIn(user)
    } catch (err) {
      setError(err.message)
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="card">
      <h2>{signup ? 'Create an account' : 'Sign in'}</h2>
      <form key={signup} className="inline" onSubmit={submit}>
        <label>Username <input name="username" autoComplete="username" required maxLength={32} /></label>
        <label>Password <input name="password" type="password" autoComplete={signup ? 'new-password' : 'current-password'} required minLength={signup ? 12 : undefined} maxLength={128} /></label>
        <button className="primary" disabled={pending}>{signup ? 'Create account' : 'Sign in'}</button>
      </form>
      {signup && <p className="muted">Use a password with at least 12 characters.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <button className="link" disabled={pending} onClick={() => { setSignup(!signup); setError('') }}>
        {signup ? 'Back to sign in' : 'Create an account'}
      </button>
    </section>
  )
}

export default function App() {
  const [user, setUser] = useState(undefined)
  const [error, setError] = useState('')
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    let active = true
    const expire = () => {
      setUser(null)
      setError('Your session ended. Sign in to continue.')
    }
    api.session().then(({ user }) => {
      if (active) setUser(user)
    }).catch((err) => {
      if (active) setError(err.message)
    })
    window.addEventListener('grocery:session-expired', expire)
    return () => {
      active = false
      window.removeEventListener('grocery:session-expired', expire)
    }
  }, [])

  async function signOut() {
    setSigningOut(true)
    setError('')
    try {
      await api.logout()
      setUser(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="app">
      <header>
        <h1>Grocery Manager</h1>
        {user && (
          <div className="inline">
            <span>{user.username}</span>
            <button onClick={signOut} disabled={signingOut}>Sign out</button>
          </div>
        )}
      </header>
      {error && <p className="error" role="alert">{error}</p>}
      {user === undefined
        ? !error && <p>Checking session...</p>
        : user
          ? <Groceries key={user.id} />
          : <SignIn onSignedIn={(account) => { setError(''); setUser(account) }} />}
    </div>
  )
}

function Groceries() {
  const [items, setItems] = useState(null)
  const [tab, setTab] = useState('dashboard')
  const [error, setError] = useState('')

  const refresh = () => api.items().then((data) => { setItems(data); setError('') }).catch((err) => setError(err.message))
  useEffect(() => {
    refresh()
  }, [])

  if (!items) return error ? <p className="error" role="alert">{error}</p> : <p>Loading inventory...</p>

  return (
    <>
      {error && <p className="error" role="alert">{error}</p>}
      {items.length > 0 && (
          <nav aria-label="Grocery views" className="filters">
            <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => setTab('dashboard')}>
              Inventory
            </button>
            <button className={tab === 'lists' ? 'active' : ''} onClick={() => setTab('lists')}>
              Shopping Lists
            </button>
          </nav>
      )}
      {items.length === 0 ? (
        <Onboarding refresh={refresh} />
      ) : tab === 'dashboard' ? (
        <Dashboard items={items} refresh={refresh} />
      ) : (
        <Lists items={items} refresh={refresh} />
      )}
    </>
  )
}
