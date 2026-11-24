import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const derive = promisify(scrypt)
const hashPassword = (password, salt) =>
  derive(password, salt, 64, { N: 2 ** 17, r: 8, p: 1, maxmem: 160 * 1024 ** 2 })
const tokenHash = (token) => createHash('sha256').update(token).digest('hex')
const cookieName = 'grocery_session'
const sessionMs = 8 * 60 * 60 * 1000
const usernamePattern = /^[a-z0-9][a-z0-9_.-]{2,31}$/

export function installAuth(app, db) {
  const findUser = db.prepare('SELECT * FROM users WHERE username = ?')
  const insertUser = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
  const deleteSession = db.prepare('DELETE FROM sessions WHERE token_hash = ?')
  const lookupSession = db.prepare(`
    SELECT users.id, users.username FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE token_hash = ? AND expires_at > ?
  `)
  const dummySalt = randomBytes(16).toString('hex')
  let inFlight = 0
  let windowStart = 0
  let attempts = 0

  const cookieOptions = (req) => ({ httpOnly: true, sameSite: 'strict', secure: req.secure, path: '/' })
  const identify = (req) => req.sessionHash && lookupSession.get(req.sessionHash, Date.now())

  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store')
    // A cross-origin browser cannot send this header without a permitted CORS preflight.
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('X-Grocery-Request') !== '1') {
      return res.status(403).json({ error: 'Request not allowed' })
    }
    const match = req.headers.cookie?.match(/(?:^|;\s*)grocery_session=([a-f0-9]{64})(?=;|$)/)
    if (match) req.sessionHash = tokenHash(match[1])
    next()
  })

  app.get('/api/auth/session', (req, res) => res.json({ user: identify(req) || null }))

  function authenticate(signup) {
    return async (req, res) => {
      const username = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : ''
      const password = req.body?.password
      if (!usernamePattern.test(username) || typeof password !== 'string' || password.length < 12 || password.length > 128) {
        return res.status(signup ? 400 : 401).json({
          error: signup ? 'Use a 3–32 character username (letters, numbers, dots, underscores or hyphens) and a 12–128 character password.' : 'Invalid username or password',
        })
      }
      const now = Date.now()
      if (now - windowStart >= 60_000) {
        windowStart = now
        attempts = 0
      }
      if (attempts >= 60 || inFlight >= 2) {
        res.set('Retry-After', attempts >= 60 ? '60' : '1')
        return res.status(429).json({ error: 'Too many attempts. Try again shortly.' })
      }
      attempts++
      inFlight++
      try {
        let user = findUser.get(username)
        if (signup) {
          const salt = randomBytes(16).toString('hex')
          const digest = await hashPassword(password, salt)
          if (findUser.get(username)) return res.status(409).json({ error: 'Username is unavailable' })
          const { lastInsertRowid } = insertUser.run(username, `${salt}:${digest.toString('hex')}`)
          user = { id: lastInsertRowid, username }
        } else {
          const [salt, stored] = user?.password_hash.split(':') ?? [dummySalt]
          const digest = await hashPassword(password, salt)
          if (!stored || !timingSafeEqual(digest, Buffer.from(stored, 'hex'))) {
            return res.status(401).json({ error: 'Invalid username or password' })
          }
        }
        const token = randomBytes(32).toString('hex')
        db.transaction(() => {
          if (req.sessionHash) deleteSession.run(req.sessionHash)
          db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now())
          db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
            .run(tokenHash(token), user.id, Date.now() + sessionMs)
        })()
        res.cookie(cookieName, token, cookieOptions(req))
        res.status(signup ? 201 : 200).json({ user: { id: user.id, username: user.username } })
      } finally {
        inFlight--
      }
    }
  }

  app.post('/api/auth/signup', authenticate(true))
  app.post('/api/auth/login', authenticate(false))
  app.post('/api/auth/logout', (req, res) => {
    if (req.sessionHash) deleteSession.run(req.sessionHash)
    res.clearCookie(cookieName, cookieOptions(req)).status(204).end()
  })

  app.use('/api', (req, res, next) => {
    const user = identify(req)
    if (!user) return res.status(401).json({ error: 'Sign in to continue' })
    req.userId = user.id
    next()
  })
}
