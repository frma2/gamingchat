import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { parseJsonResponse } from '../utils/api.js'
import styles from './Auth.module.scss'

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [pendingEmail, setPendingEmail] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      const data = await parseJsonResponse(res)
      if (!res.ok) throw new Error(data.error || 'Registration failed')
      if (data.pendingVerification) {
        setPendingEmail(data.email)
        // no email provider configured for this demo; alert simulates the verification email
        window.alert(`Your verification code is: ${data.code}`)
        return
      }
      login(data)
      navigate('/chat', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleVerify = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingEmail, code }),
      })
      const data = await parseJsonResponse(res)
      if (!res.ok) throw new Error(data.error || 'Verification failed')
      login(data)
      navigate('/chat', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (pendingEmail) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>Verify Your Email</h1>
          <p className={styles.hint}>
            This email was used by a previously deleted account. Enter the 6-digit code sent to{' '}
            {pendingEmail} to finish creating your account.
          </p>
          <form onSubmit={handleVerify}>
            <div className={styles.field}>
              <label htmlFor="verify-code">Verification Code</label>
              <input
                id="verify-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                title="6-digit verification code"
                required
              />
            </div>
            {error && <p className={styles.error}>{error}</p>}
            <button type="submit" className={styles.submit} disabled={submitting}>
              {submitting ? 'Verifying...' : 'Verify & Create Account'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Create Account</h1>
        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label htmlFor="register-name">Name</label>
            <input
              id="register-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="register-email">Email</label>
            <input
              id="register-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="register-password">Password</label>
            <input
              id="register-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              pattern="(?=.*[0-9]|.*[^A-Za-z0-9]).{8,}"
              title="At least 8 characters, including a number or special character"
              required
            />
          </div>
          <p className={styles.hint}>
            Password must be at least 8 characters and include a number or special character.
          </p>
          {error && <p className={styles.error}>{error}</p>}
          <button type="submit" className={styles.submit} disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Account'}
          </button>
        </form>
        <p className={styles.footer}>
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  )
}
