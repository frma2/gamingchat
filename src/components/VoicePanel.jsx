import { useEffect, useRef } from 'react'
import styles from '../styles/VoicePanel.module.scss'

function RemoteAudio({ stream }) {
  const audioRef = useRef(null)

  useEffect(() => {
    if (audioRef.current) audioRef.current.srcObject = stream
  }, [stream])

  return <audio ref={audioRef} autoPlay />
}

// video is always muted: audio is played by RemoteAudio, and the local preview must not echo the microphone
function CameraTile({ stream, name, self }) {
  const videoRef = useRef(null)

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream
  }, [stream])

  return (
    <figure className={styles.tile}>
      <video ref={videoRef} className={self ? styles.mirrored : undefined} autoPlay playsInline muted />
      <figcaption className={styles.tileName}>{self ? `${name} (you)` : name}</figcaption>
    </figure>
  )
}

function cameraGridColumnsClass(count) {
  if (count >= 6) return styles.threeColumns
  if (count >= 3) return styles.twoColumns
  return ''
}

export default function VoicePanel({ voice, currentUser }) {
  const {
    participants,
    joined,
    joining,
    muted,
    remoteStreams,
    remoteCameras,
    cameraStream,
    cameraStarting,
    error,
    join,
    leave,
    toggleMute,
    toggleCamera,
  } = voice

  const cameraStreamFor = (name) => {
    if (name === currentUser) return cameraStream
    return remoteCameras[name] ? remoteStreams[name] : null
  }
  const activeCameras = participants.filter((name) => cameraStreamFor(name))

  return (
    <section className={`${styles.panel} ${activeCameras.length > 0 ? styles.withCameras : ''}`}>
      <h2 className={styles.heading}>🔊 Public Voice ({participants.length})</h2>
      <div className={styles.body}>
        <div className={styles.sidebar}>
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
        </div>
        {activeCameras.length > 0 && (
          <div className={styles.cameraArea}>
            <div className={`${styles.cameraGrid} ${cameraGridColumnsClass(activeCameras.length)}`}>
              {activeCameras.map((name) => (
                <CameraTile key={name} stream={cameraStreamFor(name)} name={name} self={name === currentUser} />
              ))}
            </div>
          </div>
        )}
      </div>
      <div className={styles.actions}>
        {joined ? (
          <>
            <button type="button" className={styles.button} onClick={toggleMute}>
              {muted ? 'Unmute' : 'Mute'}
            </button>
            <button type="button" className={styles.button} onClick={toggleCamera} disabled={cameraStarting}>
              {cameraStream ? 'Cam off' : 'Cam on'}
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
