import { afterEach, describe, expect, it, vi } from 'vitest'
import Database from 'better-sqlite3'
import { fileURLToPath } from 'node:url'
import { openDb } from '../src/db.js'

vi.mock('better-sqlite3', () => ({
  default: vi.fn(function () {
    this.pragma = vi.fn(() => ['weekly', 'max_buy', 'package_amount', 'package_unit'].map((name) => ({ name })))
    this.exec = vi.fn()
  }),
}))

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('database location', () => {
  it('uses the project database when started from the server directory', () => {
    vi.spyOn(process, 'cwd').mockReturnValue(fileURLToPath(new URL('..', import.meta.url)))

    openDb()

    expect(Database).toHaveBeenCalledWith(fileURLToPath(new URL('../../grocery.db', import.meta.url)))
  })

  it.each([':memory:', 'custom.db', '/tmp/custom-grocery.db'])('preserves an explicit path: %s', (path) => {
    openDb(path)

    expect(Database).toHaveBeenCalledWith(path)
  })
})
