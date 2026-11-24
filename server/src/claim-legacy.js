import { pathToFileURL } from 'node:url'
import { openDb } from './db.js'

export function claimLegacy(db, username) {
  return db.transaction(() => {
    const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim().toLowerCase())
    if (!user) throw new Error('Account not found. Create it in the app first.')
    const items = db.prepare('UPDATE items SET user_id = ? WHERE user_id IS NULL').run(user.id).changes
    const lists = db.prepare('UPDATE lists SET user_id = ? WHERE user_id IS NULL').run(user.id).changes
    if (!items && !lists) throw new Error('No unassigned data remains to transfer.')
    return { items, lists }
  }).immediate()
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: npm run claim-legacy -- YOUR_USERNAME')
    const db = openDb(process.env.DB_PATH, { fileMustExist: true })
    try {
      const { items, lists } = claimLegacy(db, process.argv[2])
      console.log(`Transferred ${items} grocery items (with store prices) and ${lists} shopping lists.`)
    } finally {
      db.close()
    }
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
