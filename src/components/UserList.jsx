import styles from './UserList.module.scss'

export default function UserList({ users, currentUser, activeConversation, onSelect }) {
  return (
    <aside className={styles.sidebar}>
      <h2 className={styles.heading}>Chats</h2>
      <button
        type="button"
        className={`${styles.publicEntry} ${activeConversation === 'public' ? styles.active : ''}`}
        onClick={() => onSelect('public')}
      >
        # Public Chat
      </button>
      <h3 className={styles.subheading}>Online ({users.length})</h3>
      <ul className={styles.list}>
        {users.map((name) => (
          <li key={name}>
            <button
              type="button"
              className={`${styles.entry} ${activeConversation === name ? styles.active : ''}`}
              onClick={() => onSelect(name)}
              disabled={name === currentUser}
            >
              <span className={styles.dot} />
              {name}
              {name === currentUser && <span className={styles.you}> (you)</span>}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  )
}
