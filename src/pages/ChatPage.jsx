import { useEffect, useRef, useState } from 'react'
import ChatWindow from '../components/ChatWindow.jsx'
import MessageInput from '../components/MessageInput.jsx'
import UserList from '../components/UserList.jsx'
import VoicePanel from '../components/VoicePanel.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import useVoiceChat from '../hooks/useVoiceChat.js'
import styles from './ChatPage.module.scss'

const STREAM_RECONNECT_MS = 3000

export default function ChatPage() {
  const { user } = useAuth()
  const [publicMessages, setPublicMessages] = useState([])
  const [privateMessages, setPrivateMessages] = useState({}) // { [otherUser]: Message[] }
  const [onlineUsers, setOnlineUsers] = useState([])
  const [activeConversation, setActiveConversation] = useState('public') // 'public' | username
  const [chatStream, setChatStream] = useState(null) // shared with voice chat, which signals over the same stream
  const voice = useVoiceChat(chatStream, user?.name ?? 'anonymous')
  const seenIds = useRef(new Set())
  const privateMessagesRef = useRef(privateMessages)

  useEffect(() => {
    privateMessagesRef.current = privateMessages
  }, [privateMessages])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const addPublicMessage = (message) => {
    if (seenIds.current.has(message.id)) return
    seenIds.current.add(message.id)
    setPublicMessages((prev) => [...prev, message])
  }

  const addPrivateMessage = (otherUser, message) => {
    if (seenIds.current.has(message.id)) return
    seenIds.current.add(message.id)
    setPrivateMessages((prev) => ({
      ...prev,
      [otherUser]: [...(prev[otherUser] ?? []), message],
    }))
  }

  const fetchPublicHistory = () => {
    fetch('/api/messages')
      .then((res) => res.json())
      .then((history) => history.forEach(addPublicMessage))
      .catch((err) => console.error('Failed to load message history', err))
  }

  const fetchPrivateHistory = (target) => {
    const params = new URLSearchParams({ me: user?.name ?? 'anonymous', with: target })
    fetch(`/api/messages/private?${params}`)
      .then((res) => res.json())
      .then((history) => history.forEach((message) => addPrivateMessage(target, message)))
      .catch((err) => console.error('Failed to load private history', err))
  }

  useEffect(() => {
    fetchPublicHistory()

    // consumer echoes each produced message back through this stream
    const params = new URLSearchParams({ user: user?.name ?? 'anonymous' })
    let source = null
    let reconnectTimer = null
    let hasConnectedOnce = false

    const connect = () => {
      source = new EventSource(`/api/messages/stream?${params}`)
      source.onopen = () => {
        // 'open' also fires after a reconnect; re-sync in case messages were missed meanwhile
        if (hasConnectedOnce) {
          fetchPublicHistory()
          Object.keys(privateMessagesRef.current).forEach(fetchPrivateHistory)
        }
        hasConnectedOnce = true
      }
      source.onmessage = (event) => {
        const message = JSON.parse(event.data)
        if (message.to) {
          const otherUser = message.user === user?.name ? message.to : message.user
          addPrivateMessage(otherUser, message)
        } else {
          addPublicMessage(message)
        }
      }
      source.addEventListener('presence', (event) => setOnlineUsers(JSON.parse(event.data)))
      source.onerror = () => {
        console.error('Chat stream connection error')
        // the browser only auto-reconnects after network drops; an error response (e.g. a 502 from the proxy while
        // the server restarts) closes the stream for good, which would leave us offline and unable to join voice
        if (source.readyState === EventSource.CLOSED && !reconnectTimer) {
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null
            connect()
          }, STREAM_RECONNECT_MS)
        }
      }
      setChatStream(source)
    }
    connect()

    return () => {
      clearTimeout(reconnectTimer)
      source.close()
      setChatStream(null)
    }
  }, [user?.name])

  const handleSelectConversation = (target) => {
    setActiveConversation(target)
    if (target !== 'public' && !privateMessages[target]) {
      fetchPrivateHistory(target)
    }
  }

  const handleSend = async (payload) => {
    const body = { ...payload, user: user?.name }
    if (activeConversation !== 'public') {
      body.to = activeConversation
    }
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`Request failed: ${res.status}`)
    } catch (err) {
      console.error('Failed to send message', err)
    }
  }

  const activeMessages =
    activeConversation === 'public' ? publicMessages : privateMessages[activeConversation] ?? []

  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        <div className={styles.card}>
          <div className={styles.header}>
            <h1>{activeConversation === 'public' ? 'Chat' : `Private: ${activeConversation}`}</h1>
          </div>
          <ChatWindow messages={activeMessages} />
          <MessageInput onSend={handleSend} />
        </div>
        <UserList
          users={onlineUsers}
          currentUser={user?.name}
          activeConversation={activeConversation}
          onSelect={handleSelectConversation}
        />
        <VoicePanel voice={voice} currentUser={user?.name} />
      </div>
    </div>
  )
}
