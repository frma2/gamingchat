import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { parseJsonResponse } from '../utils/api.js'
import styles from './Auth.module.scss'

export default function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, currentPassword, newPassword }),
      })
      const data = await parseJsonResponse(res)
      if (!res.ok) throw new Error(data.error || 'Failed to change password')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSuccess(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Change Password</h1>
        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label htmlFor="current-password">Current Password</label>
            <input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="new-password">New Password</label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              pattern="(?=.*[0-9]|.*[^A-Za-z0-9]).{8,}"
              title="At least 8 characters, including a number or special character"
              required
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="confirm-password">Confirm New Password</label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <p className={styles.hint}>
            Password must be at least 8 characters and include a number or special character.
          </p>
          {error && <p className={styles.error}>{error}</p>}
          {success && <p className={styles.hint}>Password changed successfully.</p>}
          <button type="submit" className={styles.submit} disabled={submitting}>
            {submitting ? 'Updating...' : 'Update Password'}
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
