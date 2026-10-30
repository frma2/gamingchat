import { useEffect, useRef } from 'react'
import styles from './VoicePanel.module.scss'

function RemoteAudio({ stream }) {
  const audioRef = useRef(null)

  useEffect(() => {
    if (audioRef.current) audioRef.current.srcObject = stream
  }, [stream])

  return <audio ref={audioRef} autoPlay />
}

export default function VoicePanel({ voice, currentUser }) {
  const { participants, joined, joining, muted, remoteStreams, error, join, leave, toggleMute } = voice

  return (
    <section className={styles.panel}>
      <h2 className={styles.heading}>🔊 Public Voice ({participants.length})</h2>
      <ul className={styles.list}>
        {participants.map((name) => (
          <li key={name} className={styles.participant}>
            <span className={`${styles.dot} ${name !== currentUser && !remoteStreams[name] ? styles.connecting : ''}`} />
            {name}
            {name === currentUser && <span className={styles.you}> (you{muted ? ', muted' : ''})</span>}
          </li>
        ))}
        {participants.length === 0 && <li className={styles.empty}>Nobody is talking yet</li>}
      </ul>
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.actions}>
        {joined ? (
          <>
            <button type="button" className={styles.button} onClick={toggleMute}>
              {muted ? 'Unmute' : 'Mute'}
            </button>
            <button type="button" className={`${styles.button} ${styles.leave}`} onClick={leave}>
              Leave
            </button>
          </>
        ) : (
          <button type="button" className={`${styles.button} ${styles.join}`} onClick={join} disabled={joining}>
            {joining ? 'Joining…' : 'Join voice'}
          </button>
        )}
      </div>
      {Object.entries(remoteStreams).map(([name, stream]) => (
        <RemoteAudio key={name} stream={stream} />
      ))}
    </section>
  )
}
