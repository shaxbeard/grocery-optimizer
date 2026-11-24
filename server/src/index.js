import express from 'express'
import { fileURLToPath } from 'node:url'
import { createApp } from './app.js'
import { openDb } from './db.js'

const app = createApp(openDb(process.env.DB_PATH), { behindHttpsProxy: process.env.HTTPS_PROXY_MODE === '1' })
const dist = fileURLToPath(new URL('../../client/dist', import.meta.url))
app.use(express.static(dist))
app.get('/{*splat}', (req, res) => res.sendFile(dist + '/index.html'))

const port = process.env.PORT ?? 3001
const host = process.env.RENDER === 'true' ? '0.0.0.0' : '127.0.0.1'
app.listen(port, host, () => console.log(`Grocery Manager listening on ${host}:${port}`))