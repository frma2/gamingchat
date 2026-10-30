import { randomUUID } from 'crypto'
import express from 'express'
import cors from 'cors'
import { sendChatMessage, startChatConsumer } from './kafka/chat_kafka.js'
import { registerUser, authenticateUser, changePassword, deleteAccount, verifyRegistration, ValidationError } from './auth/auth.js'

const app = express()
app.use(cors())
app.use(express.json())

const MAX_HISTORY = 100
const history = []
const privateHistories = new Map() // conversationKey -> messages
const sseClients = new Map() // res -> username
const voiceParticipants = new Set() // usernames currently in the public voice channel

// set GIPHY_API_KEY to enable gif search.
const GIPHY_API_KEY = process.env.GIPHY_API_KEY || ''

function conversationKey(a, b) {
  return [a, b].sort().join('|')
}

// Restricts rendered/stored gif urls to Giphy's CDN so clients can't be made to embed arbitrary content.
function isGiphyUrl(url) {
  try {
    const { protocol, hostname } = new URL(url)
    return protocol === 'https:' && /(^|\.)giphy\.com$/.test(hostname)
  } catch {
    return false
  }
}


// writes to every client matching predicate; a throw means the connection is dead even though 'close' never fired (e.g. network drop)
function sendToClients(payload, predicate = () => true) {
  const deadClients = []
  for (const [res, username] of sseClients) {
    if (!predicate(username)) continue
    try {
      res.write(payload)
    } catch {
      deadClients.push(res)
    }
  }
  return deadClients
}

function pruneClients(deadClients) {
  if (!deadClients.length) return
  for (const res of deadClients) sseClients.delete(res)
  broadcastPresence()
  pruneVoiceParticipants()
}

function trimmedString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function voiceParticipantsPayload() {
  return `event: voice-participants\ndata: ${JSON.stringify([...voiceParticipants].sort())}\n\n`
}

function broadcastVoiceParticipants() {
  pruneClients(sendToClients(voiceParticipantsPayload()))
}

// a participant without any open stream can no longer receive signaling, so drop them from voice
function pruneVoiceParticipants() {
  const connected = new Set(sseClients.values())
  let changed = false
  for (const name of voiceParticipants) {
    if (!connected.has(name)) {
      voiceParticipants.delete(name)
      changed = true
    }
  }
  if (changed) broadcastVoiceParticipants()
}

function broadcast(message) {
  if (message.to) {
    const key = conversationKey(message.user, message.to)
    const convo = privateHistories.get(key) ?? []
    convo.push(message)
    if (convo.length > MAX_HISTORY) convo.shift()
    privateHistories.set(key, convo)
  } else {
    history.push(message)
    if (history.length > MAX_HISTORY) history.shift()
  }

  // private messages are only delivered to the sender and the recipient
  const deadClients = sendToClients(
    `data: ${JSON.stringify(message)}\n\n`,
    (username) => !message.to || username === message.to || username === message.user
  )
  pruneClients(deadClients)
}

function broadcastPresence() {
  const users = [...new Set(sseClients.values())].sort()
  const deadClients = sendToClients(`event: presence\ndata: ${JSON.stringify(users)}\n\n`)
  pruneClients(deadClients)
}

// Node keeps SSE sockets open indefinitely (no inactivity timeout), so a client that vanishes without a
// clean TCP close (sleep, dropped wifi, killed proxy) would otherwise stay "online" forever; pinging
// periodically surfaces the write failure so the dead client gets pruned and presence stays accurate.
const PRESENCE_HEARTBEAT_MS = 20_000
setInterval(() => pruneClients(sendToClients(': heartbeat\n\n')), PRESENCE_HEARTBEAT_MS)

app.get('/api/messages', (req, res) => {
  res.json(history)
})

app.get('/api/messages/private', (req, res) => {
  const { me, with: withUser } = req.query
  if (typeof me !== 'string' || !me.trim() || typeof withUser !== 'string' || !withUser.trim()) {
    return res.status(400).json({ error: 'me and with are required' })
  }
  const key = conversationKey(me.trim(), withUser.trim())
  res.json(privateHistories.get(key) ?? [])
})

app.get('/api/messages/stream', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })
  res.flushHeaders()

  const username = typeof req.query.user === 'string' && req.query.user.trim() ? req.query.user.trim() : 'anonymous'
  sseClients.set(res, username)
  broadcastPresence()
  res.write(voiceParticipantsPayload())

  req.on('close', () => {
    sseClients.delete(res)
    broadcastPresence()
    pruneVoiceParticipants()
  })
})

app.post('/api/voice/join', (req, res) => {
  const user = trimmedString(req.body?.user)
  if (!user) return res.status(400).json({ error: 'user is required' })
  // signaling is delivered over the chat stream, so a user without one couldn't complete a connection
  if (![...sseClients.values()].includes(user)) {
    return res.status(409).json({ error: 'chat stream must be open before joining voice' })
  }
  voiceParticipants.add(user)
  broadcastVoiceParticipants()
  res.status(204).end()
})

app.post('/api/voice/leave', (req, res) => {
  const user = trimmedString(req.body?.user)
  if (!user) return res.status(400).json({ error: 'user is required' })
  if (voiceParticipants.delete(user)) broadcastVoiceParticipants()
  res.status(204).end()
})

// relays WebRTC offers/answers/ICE candidates between participants; bypasses Kafka since signals are
// ephemeral, latency sensitive, and meaningless to replay
app.post('/api/voice/signal', (req, res) => {
  const from = trimmedString(req.body?.from)
  const to = trimmedString(req.body?.to)
  const signal = req.body?.signal
  if (!from || !to || !signal || typeof signal !== 'object') {
    return res.status(400).json({ error: 'from, to and signal are required' })
  }
  if (!voiceParticipants.has(from) || !voiceParticipants.has(to)) {
    return res.status(409).json({ error: 'both users must be in voice' })
  }
  const payload = `event: voice-signal\ndata: ${JSON.stringify({ from, signal })}\n\n`
  pruneClients(sendToClients(payload, (username) => username === to))
  res.status(204).end()
})

app.get('/api/gifs/search', async (req, res) => {
  if (!GIPHY_API_KEY) {
    return res.status(503).json({ error: 'Gif search is not configured. Set GIPHY_API_KEY on the server.' })
  }

  const query = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  if (!query) return res.json([])

  try {
    const params = new URLSearchParams({ api_key: GIPHY_API_KEY, q: query, limit: '16', rating: 'pg-13' })
    const giphyRes = await fetch(`https://api.giphy.com/v1/gifs/search?${params}`)
    if (!giphyRes.ok) throw new Error(`Giphy request failed: ${giphyRes.status}`)
    const { data } = await giphyRes.json()
    const gifs = data.map((gif) => ({
      id: gif.id,
      previewUrl: gif.images.fixed_height_small?.url ?? gif.images.fixed_height.url,
      url: gif.images.fixed_height.url,
    }))
    res.json(gifs)
  } catch (err) {
    console.error('Failed to search gifs', err)
    res.status(500).json({ error: 'Failed to search gifs' })
  }
})

app.post('/api/messages', async (req, res) => {
  const { text, user, to, gifUrl } = req.body ?? {}
  const trimmedText = typeof text === 'string' ? text.trim() : ''
  const trimmedGifUrl = typeof gifUrl === 'string' ? gifUrl.trim() : ''

  if (!trimmedText && !trimmedGifUrl) {
    return res.status(400).json({ error: 'text or gifUrl is required' })
  }
  if (trimmedGifUrl && !isGiphyUrl(trimmedGifUrl)) {
    return res.status(400).json({ error: 'invalid gifUrl' })
  }

  const message = {
    id: randomUUID(),
    text: trimmedText,
    user: typeof user === 'string' && user.trim() ? user.trim() : 'anonymous',
    timestamp: Date.now(),
  }
  if (trimmedGifUrl) {
    message.gifUrl = trimmedGifUrl
  }
  if (typeof to === 'string' && to.trim()) {
    message.to = to.trim()
  }

  try {
    // message is echoed back to clients once the consumer reads it from Kafka
    await sendChatMessage(message)
    res.status(202).json(message)
  } catch (err) {
    console.error('Failed to send message', err)
    res.status(500).json({ error: 'Failed to send message' })
  }
})

app.post('/api/auth/register', async (req, res) => {
  try {
    const result = await registerUser(req.body ?? {})
    if (result.status === 'pending') {
      // code is included in the response to simulate email delivery since no mail provider is configured
      return res.status(202).json({ pendingVerification: true, email: result.email, code: result.code })
    }
    res.status(201).json(result.user)
  } catch (err) {
    if (err instanceof ValidationError) return res.status(400).json({ error: err.message })
    console.error('Failed to register user', err)
    res.status(500).json({ error: 'Failed to register user' })
  }
})

app.post('/api/auth/register/verify', async (req, res) => {
  try {
    const user = await verifyRegistration(req.body ?? {})
    res.status(201).json(user)
  } catch (err) {
    if (err instanceof ValidationError) return res.status(400).json({ error: err.message })
    console.error('Failed to verify registration', err)
    res.status(500).json({ error: 'Failed to verify registration' })
  }
})

app.post('/api/auth/login', async (req, res) => {
  try {
    const user = await authenticateUser(req.body ?? {})
    res.json(user)
  } catch (err) {
    if (err instanceof ValidationError) return res.status(401).json({ error: err.message })
    console.error('Failed to authenticate user', err)
    res.status(500).json({ error: 'Failed to authenticate user' })
  }
})

app.post('/api/auth/change-password', async (req, res) => {
  try {
    const user = await changePassword(req.body ?? {})
    res.json(user)
  } catch (err) {
    if (err instanceof ValidationError) return res.status(400).json({ error: err.message })
    console.error('Failed to change password', err)
    res.status(500).json({ error: 'Failed to change password' })
  }
})

app.post('/api/auth/delete-account', async (req, res) => {
  try {
    await deleteAccount(req.body ?? {})
    res.status(204).end()
  } catch (err) {
    if (err instanceof ValidationError) return res.status(400).json({ error: err.message })
    console.error('Failed to delete account', err)
    res.status(500).json({ error: 'Failed to delete account' })
  }
})

const PORT = process.env.PORT || 4000

app.listen(PORT, () => {
  console.log(`Chat API listening on port ${PORT}`)
})

// started separately so a down/unreachable Kafka broker doesn't block the HTTP API from serving requests
// retries with backoff since Kafka may still be starting up (e.g. right after `docker compose up`)
async function startChatConsumerWithRetry(retryDelayMs = 5000) {
  try {
    await startChatConsumer(broadcast)
  } catch (err) {
    console.error(`Failed to start chat consumer, is Kafka running? Retrying in ${retryDelayMs}ms`, err)
    setTimeout(() => startChatConsumerWithRetry(retryDelayMs), retryDelayMs)
  }
}

startChatConsumerWithRetry()
