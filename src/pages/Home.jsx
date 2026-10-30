import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function Home() {
  const { user } = useAuth()
  return (
    <div>
      <h1>Welcome{user ? `, ${user.name}` : ''}</h1>
      <p>
        Go to the <Link to="/chat">Chat</Link> page to start messaging.
      </p>
    </div>
  )
}
