import { useEffect, useRef } from 'react'
import styles from './ChatWindow.module.scss'
import { linkify } from '../utils/linkify.jsx'
import { formatTime, groupMessagesByDay } from '../utils/formatDate.js'

export default function ChatWindow({ messages }) {
  const listRef = useRef(null)

  // scrolls only the message list; scrollIntoView would also scroll the page itself down
  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [messages])

  const groups = groupMessagesByDay(messages)

  return (
    <ul className={styles.list} ref={listRef}>
      {groups.map((group) => (
        <li key={group.label + group.messages[0]?.id} className={styles.dayGroup}>
          <div className={styles.dateDivider}>
            <span>{group.label}</span>
          </div>
          <ul className={styles.dayMessages}>
            {group.messages.map((message) => (
              <li key={message.id} className={styles.message}>
                <strong className={styles.user}>{message.user}:</strong>{' '}
                {message.gifUrl ? (
                  <img src={message.gifUrl} alt="gif" className={styles.gif} />
                ) : (
                  linkify(message.text)
                )}
                <span className={styles.timestamp}>{formatTime(message.timestamp)}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  )
}
