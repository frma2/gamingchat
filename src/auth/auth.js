import { randomUUID, randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import db from '../db/db.js'
import { isMailerConfigured, sendMail } from '../email/mailer.js'

const scryptAsync = promisify(scrypt)
const SALT_BYTES = 32
const KEY_LENGTH = 64
const CODE_TTL_MS = 10 * 60 * 1000

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// 8+ chars, at least one number or special character
const PASSWORD_RE = /^(?=.*[0-9]|.*[^A-Za-z0-9]).{8,}$/

export class ValidationError extends Error {}

// email -> { code, expiresAt, name, email, salt, passwordHash }
const pendingRegistrations = new Map()

function generateCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

async function sendVerificationEmail(email, code) {
  if (!isMailerConfigured()) {
    // no SMTP credentials configured for this environment; log instead of sending a real email
    console.log(`[auth] Verification code for ${email}: ${code}`)
    return
  }

  try {
    await sendMail({
      to: email,
      subject: 'Your verification code',
      text: `Your verification code is: ${code}\nIt expires in 10 minutes.`,
    })
  } catch (err) {
    console.error('Failed to send verification email', err)
  }
}

function assertValid({ name, email, password }) {
  if (typeof name !== 'string' || !name.trim()) {
    throw new ValidationError('Name is required')
  }
  if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
    throw new ValidationError('A valid email is required')
  }
  if (typeof password !== 'string' || !PASSWORD_RE.test(password)) {
    throw new ValidationError(
      'Password must be at least 8 characters and include a number or special character',
    )
  }
}

async function hashPassword(password, salt) {
  const derived = await scryptAsync(password, salt, KEY_LENGTH)
  return derived.toString('hex')
}

export async function registerUser({ name, email, password }) {
  assertValid({ name, email, password })
  const normalizedEmail = email.trim().toLowerCase()

  const existing = db
    .prepare('SELECT id FROM users WHERE email = ? AND deleted_at IS NULL')
    .get(normalizedEmail)
  if (existing) {
    throw new ValidationError('Email is already registered')
  }

  // most recently deleted account for this email, if any
  const deletedUser = db
    .prepare('SELECT * FROM users WHERE email = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 1')
    .get(normalizedEmail)

  if (deletedUser) {
    if (await verifyPassword(password, deletedUser)) {
      throw new ValidationError('New password must be different from your previous password')
    }

    const salt = randomBytes(SALT_BYTES).toString('hex')
    const passwordHash = await hashPassword(password, salt)
    const code = generateCode()
    pendingRegistrations.set(normalizedEmail, {
      code,
      expiresAt: Date.now() + CODE_TTL_MS,
      name: name.trim(),
      email: normalizedEmail,
      salt,
      passwordHash,
    })
    await sendVerificationEmail(normalizedEmail, code)

    // code is returned directly since there's no real email provider wired up for this demo
    return { status: 'pending', email: normalizedEmail, code }
  }

  const id = randomUUID()
  const salt = randomBytes(SALT_BYTES).toString('hex')
  const passwordHash = await hashPassword(password, salt)

  db.prepare(
    'INSERT INTO users (id, name, email, salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, name.trim(), normalizedEmail, salt, passwordHash, Date.now())

  return { status: 'created', user: { id, name: name.trim(), email: normalizedEmail } }
}

export async function verifyRegistration({ email, code }) {
  if (typeof email !== 'string' || typeof code !== 'string' || !email || !code) {
    throw new ValidationError('Email and verification code are required')
  }

  const normalizedEmail = email.trim().toLowerCase()
  const pending = pendingRegistrations.get(normalizedEmail)
  if (!pending || Date.now() > pending.expiresAt) {
    pendingRegistrations.delete(normalizedEmail)
    throw new ValidationError('Verification code expired or not found, please register again')
  }

  if (code.trim() !== pending.code) {
    throw new ValidationError('Invalid verification code')
  }

  const id = randomUUID()
  db.prepare(
    'INSERT INTO users (id, name, email, salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, pending.name, pending.email, pending.salt, pending.passwordHash, Date.now())

  pendingRegistrations.delete(normalizedEmail)

  return { id, name: pending.name, email: pending.email }
}

async function verifyPassword(password, user) {
  const candidateHash = await hashPassword(password, user.salt)
  const stored = Buffer.from(user.password_hash, 'hex')
  const candidate = Buffer.from(candidateHash, 'hex')
  return stored.length === candidate.length && timingSafeEqual(stored, candidate)
}

export async function authenticateUser({ email, password }) {
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    throw new ValidationError('Email and password are required')
  }

  const normalizedEmail = email.trim().toLowerCase()
  const user = db
    .prepare('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL')
    .get(normalizedEmail)
  if (!user) {
    throw new ValidationError('Invalid email or password')
  }

  if (!(await verifyPassword(password, user))) {
    throw new ValidationError('Invalid email or password')
  }

  return { id: user.id, name: user.name, email: user.email }
}

export async function changePassword({ email, currentPassword, newPassword }) {
  if (typeof email !== 'string' || typeof currentPassword !== 'string' || !email || !currentPassword) {
    throw new ValidationError('Current password is required')
  }
  if (typeof newPassword !== 'string' || !PASSWORD_RE.test(newPassword)) {
    throw new ValidationError(
      'New password must be at least 8 characters and include a number or special character',
    )
  }

  const normalizedEmail = email.trim().toLowerCase()
  const user = db
    .prepare('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL')
    .get(normalizedEmail)
  if (!user) {
    throw new ValidationError('Invalid email or password')
  }

  if (!(await verifyPassword(currentPassword, user))) {
    throw new ValidationError('Current password is incorrect')
  }

  const salt = randomBytes(SALT_BYTES).toString('hex')
  const passwordHash = await hashPassword(newPassword, salt)

  db.prepare('UPDATE users SET salt = ?, password_hash = ? WHERE id = ?').run(
    salt,
    passwordHash,
    user.id,
  )

  return { id: user.id, name: user.name, email: user.email }
}

export async function deleteAccount({ email, password }) {
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    throw new ValidationError('Password is required')
  }

  const normalizedEmail = email.trim().toLowerCase()
  const user = db
    .prepare('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL')
    .get(normalizedEmail)
  if (!user) {
    throw new ValidationError('Invalid email or password')
  }

  if (!(await verifyPassword(password, user))) {
    throw new ValidationError('Password is incorrect')
  }

  db.prepare('UPDATE users SET deleted_at = ? WHERE id = ?').run(Date.now(), user.id)
}
