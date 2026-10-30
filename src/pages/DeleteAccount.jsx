import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { parseJsonResponse } from '../utils/api.js'
import styles from './Auth.module.scss'

export default function DeleteAccount() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, password }),
      })
      if (!res.ok) {
        const data = await parseJsonResponse(res)
        throw new Error(data.error || 'Failed to delete account')
      }
      logout()
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Delete Account</h1>
        <p className={styles.hint}>
          This permanently deletes your account. Enter your password to confirm.
        </p>
        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label htmlFor="delete-password">Password</label>
            <input
              id="delete-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <button type="submit" className={styles.danger} disabled={submitting}>
            {submitting ? 'Deleting...' : 'Delete Account'}
          </button>
        </form>
        <p className={styles.footer}>
          <button type="button" className={styles.linkButton} onClick={() => navigate(-1)}>
            Back
          </button>
        </p>
      </div>
    </div>
  )
}
