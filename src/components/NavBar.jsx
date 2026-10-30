import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { BACKGROUNDS, useBackground } from '../context/BackgroundContext.jsx'
import styles from './NavBar.module.scss'

export default function NavBar() {
  const { user, logout } = useAuth()
  const { background, setBackground } = useBackground()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return undefined
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  if (!user) return null

  const handleSignOut = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <nav className={styles.bar}>
      <span className={styles.user}>{user.name}</span>
      <div className={styles.menu} ref={menuRef}>
        <button
          type="button"
          className={styles.menuButton}
          onClick={() => setMenuOpen((open) => !open)}
          aria-label="Menu"
          aria-expanded={menuOpen}
          title="Menu"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              fill="currentColor"
              d="M4 6h16a1 1 0 1 0 0-2H4a1 1 0 0 0 0 2Zm16 5H4a1 1 0 1 0 0 2h16a1 1 0 1 0 0-2Zm0 7H4a1 1 0 1 0 0 2h16a1 1 0 1 0 0-2Z"
            />
          </svg>
        </button>
        {menuOpen && (
          <div className={styles.dropdown}>
            <div className={styles.dropdownSection}>
              <span className={styles.dropdownLabel}>Background</span>
              <button
                type="button"
                className={`${styles.dropdownItem} ${styles.dropdownItemButton} ${
                  background === BACKGROUNDS.MATRIX ? styles.dropdownItemActive : ''
                }`}
                onClick={() => setBackground(BACKGROUNDS.MATRIX)}
              >
                Matrix
              </button>
              <button
                type="button"
                className={`${styles.dropdownItem} ${styles.dropdownItemButton} ${
                  background === BACKGROUNDS.GALAXY ? styles.dropdownItemActive : ''
                }`}
                onClick={() => setBackground(BACKGROUNDS.GALAXY)}
              >
                Galaxy
              </button>
            </div>
            <Link
              className={styles.dropdownItem}
              to="/change-password"
              onClick={() => setMenuOpen(false)}
            >
              Change Password
            </Link>
            <Link
              className={`${styles.dropdownItem} ${styles.dropdownItemDanger}`}
              to="/delete-account"
              onClick={() => setMenuOpen(false)}
            >
              Delete Account
            </Link>
          </div>
        )}
      </div>
      <button
        type="button"
        className={styles.signOut}
        onClick={handleSignOut}
        aria-label="Sign out"
        title="Sign out"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path
            fill="currentColor"
            d="M10 3a1 1 0 0 0 0 2h5v14h-5a1 1 0 1 0 0 2h6a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1h-6Z"
          />
          <path
            fill="currentColor"
            d="M12.29 8.29a1 1 0 0 1 1.42 0l3 3a1 1 0 0 1 0 1.42l-3 3a1 1 0 0 1-1.42-1.42L13.59 13H4a1 1 0 1 1 0-2h9.59l-1.3-1.29a1 1 0 0 1 0-1.42Z"
          />
        </svg>
      </button>
    </nav>
  )
}
