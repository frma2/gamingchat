import { useEffect, useRef, useState } from 'react'

// STUN lets peers discover their public address; peers behind strict/symmetric NATs additionally need a TURN server
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }]

function postJson(url, body) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then((res) => {
    if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  })
}

// Full-mesh WebRTC voice: every participant holds a direct peer connection to every other participant.
// Signaling rides on the chat's SSE stream (incoming) and POST /api/voice/signal (outgoing).
export default function useVoiceChat(source, username) {
  const [participants, setParticipants] = useState([])
  const [joined, setJoined] = useState(false)
  const [joining, setJoining] = useState(false)
  const [muted, setMuted] = useState(false)
  const [remoteStreams, setRemoteStreams] = useState({}) // { [user]: MediaStream }
  const [remoteCameras, setRemoteCameras] = useState({}) // { [user]: boolean }
  const [cameraStream, setCameraStream] = useState(null)
  const [cameraStarting, setCameraStarting] = useState(false)
  const [error, setError] = useState('')
  const joinedRef = useRef(false)
  const localStreamRef = useRef(null)
  const cameraTrackRef = useRef(null)
  const peersRef = useRef(new Map()) // user -> { pc, pendingCandidates }
  const signalChainRef = useRef(Promise.resolve())

  // signals are chained so they reach the server (and therefore the peer) in order; an ICE candidate
  // overtaking the offer it belongs to would otherwise be dropped
  const sendSignal = (to, signal) => {
    signalChainRef.current = signalChainRef.current
      .then(() => postJson('/api/voice/signal', { from: username, to, signal }))
      .catch((err) => console.error('Failed to send voice signal', err))
  }

  const closePeer = (other) => {
    const peer = peersRef.current.get(other)
    if (!peer) return
    peer.pc.close()
    peersRef.current.delete(other)
    setRemoteStreams((prev) => {
      const { [other]: _removed, ...rest } = prev
      return rest
    })
  }

  const closeAllPeers = () => {
    for (const other of [...peersRef.current.keys()]) closePeer(other)
  }

  const createPeer = (other, isOfferer) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    const peer = { pc, pendingCandidates: [] }
    peersRef.current.set(other, peer)

    const localStream = localStreamRef.current
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream))
    // a video slot is always negotiated so the camera can be toggled with replaceTrack, without renegotiating;
    // the answerer reuses the slot from the offer instead (see enableVideoSending)
    if (isOfferer) pc.addTransceiver(cameraTrackRef.current ?? 'video', { direction: 'sendrecv' })
    sendSignal(other, { type: 'camera', on: Boolean(cameraTrackRef.current) })

    pc.onicecandidate = (event) => {
      if (event.candidate) sendSignal(other, { type: 'candidate', candidate: event.candidate })
    }
    // the stream is rebuilt from the receivers rather than taken from event.streams, since the answerer's
    // video sender isn't associated with a stream
    pc.ontrack = () => {
      const stream = new MediaStream(pc.getReceivers().map((receiver) => receiver.track))
      setRemoteStreams((prev) => ({ ...prev, [other]: stream }))
    }
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') console.error(`Voice connection with ${other} failed`)
    }
    return peer
  }

  // candidates can arrive while setRemoteDescription is still pending; they're queued until it resolves
  const flushPendingCandidates = async (peer) => {
    const candidates = peer.pendingCandidates.splice(0)
    for (const candidate of candidates) {
      await peer.pc.addIceCandidate(candidate).catch((err) => console.error('Failed to add ICE candidate', err))
    }
  }

  const getVideoTransceiver = (pc) => pc.getTransceivers().find((t) => t.receiver.track.kind === 'video')

  const enableVideoSending = async (pc) => {
    const transceiver = getVideoTransceiver(pc)
    if (!transceiver) return
    transceiver.direction = 'sendrecv'
    await transceiver.sender.replaceTrack(cameraTrackRef.current)
  }

  const startCall = async (other) => {
    const { pc } = createPeer(other, true)
    try {
      await pc.setLocalDescription(await pc.createOffer())
      sendSignal(other, { type: 'offer', sdp: pc.localDescription })
    } catch (err) {
      console.error(`Failed to call ${other}`, err)
      closePeer(other)
    }
  }

  const handleSignal = async ({ from, signal }) => {
    if (!joinedRef.current) return
    try {
      if (signal.type === 'offer') {
        // a fresh offer replaces any stale connection, e.g. after the other side reconnected
        closePeer(from)
        const peer = createPeer(from, false)
        await peer.pc.setRemoteDescription(signal.sdp)
        await enableVideoSending(peer.pc)
        await flushPendingCandidates(peer)
        await peer.pc.setLocalDescription(await peer.pc.createAnswer())
        sendSignal(from, { type: 'answer', sdp: peer.pc.localDescription })
      } else if (signal.type === 'answer') {
        const peer = peersRef.current.get(from)
        if (!peer) return
        await peer.pc.setRemoteDescription(signal.sdp)
        await flushPendingCandidates(peer)
      } else if (signal.type === 'candidate') {
        const peer = peersRef.current.get(from)
        if (!peer) return
        if (peer.pc.remoteDescription) {
          await peer.pc.addIceCandidate(signal.candidate)
        } else {
          peer.pendingCandidates.push(signal.candidate)
        }
      } else if (signal.type === 'camera') {
        // kept outside the peer so it survives the closePeer that a following offer triggers
        setRemoteCameras((prev) => ({ ...prev, [from]: Boolean(signal.on) }))
      }
    } catch (err) {
      console.error(`Failed to handle voice signal from ${from}`, err)
    }
  }

  const rejoin = () => {
    if (!joinedRef.current) return
    // the server drops us from voice when the stream disconnects, so peers have already torn down their side
    closeAllPeers()
    postJson('/api/voice/join', { user: username }).catch((err) => console.error('Failed to rejoin voice', err))
  }

  // handlers are re-bound every render so they always see current state
  const handlersRef = useRef({})
  handlersRef.current = { handleSignal, rejoin }

  useEffect(() => {
    if (!source) return undefined
    const onParticipants = (event) => setParticipants(JSON.parse(event.data))
    const onSignal = (event) => handlersRef.current.handleSignal(JSON.parse(event.data))
    const onOpen = () => handlersRef.current.rejoin()
    source.addEventListener('voice-participants', onParticipants)
    source.addEventListener('voice-signal', onSignal)
    source.addEventListener('open', onOpen)
    return () => {
      source.removeEventListener('voice-participants', onParticipants)
      source.removeEventListener('voice-signal', onSignal)
      source.removeEventListener('open', onOpen)
    }
  }, [source])

  // keeps the mesh in sync with the participant list
  useEffect(() => {
    if (!joined) return
    for (const other of [...peersRef.current.keys()]) {
      if (!participants.includes(other)) closePeer(other)
    }
    for (const other of participants) {
      if (other === username || peersRef.current.has(other)) continue
      // only one side of each pair initiates, so two peers never send each other offers at the same time
      if (username < other) startCall(other)
    }
  }, [joined, participants, username])

  const join = async () => {
    if (joinedRef.current || joining) return
    setError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Voice chat requires HTTPS or localhost.')
      return
    }
    setJoining(true)
    try {
      localStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    } catch (err) {
      console.error('Failed to access microphone', err)
      setError('Could not access your microphone.')
      setJoining(false)
      return
    }
    // marked joined before the request so offers that arrive right after the server adds us aren't ignored
    joinedRef.current = true
    try {
      await postJson('/api/voice/join', { user: username })
      setJoined(true)
    } catch (err) {
      console.error('Failed to join voice', err)
      setError('Failed to join voice chat.')
      joinedRef.current = false
      localStreamRef.current.getTracks().forEach((track) => track.stop())
      localStreamRef.current = null
    } finally {
      setJoining(false)
    }
  }

  const leave = () => {
    if (!joinedRef.current) return
    joinedRef.current = false
    setJoined(false)
    setMuted(false)
    closeAllPeers()
    localStreamRef.current?.getTracks().forEach((track) => track.stop())
    localStreamRef.current = null
    cameraTrackRef.current?.stop()
    cameraTrackRef.current = null
    setCameraStream(null)
    setRemoteCameras({})
    postJson('/api/voice/leave', { user: username }).catch((err) => console.error('Failed to leave voice', err))
  }

  const setCameraTrack = (track) => {
    cameraTrackRef.current = track
    setCameraStream(track ? new MediaStream([track]) : null)
    for (const [other, { pc }] of peersRef.current) {
      getVideoTransceiver(pc)
        ?.sender.replaceTrack(track)
        .catch((err) => console.error(`Failed to update camera for ${other}`, err))
      sendSignal(other, { type: 'camera', on: Boolean(track) })
    }
  }

  const toggleCamera = async () => {
    if (!joinedRef.current || cameraStarting) return
    if (cameraTrackRef.current) {
      cameraTrackRef.current.stop()
      setCameraTrack(null)
      return
    }
    setError('')
    setCameraStarting(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      const [track] = stream.getVideoTracks()
      // the user may have left voice while the permission prompt was open
      if (!joinedRef.current) {
        track.stop()
        return
      }
      // e.g. the camera is unplugged or another app takes it over
      track.onended = () => {
        if (cameraTrackRef.current === track) setCameraTrack(null)
      }
      setCameraTrack(track)
    } catch (err) {
      console.error('Failed to access camera', err)
      setError('Could not access your camera.')
    } finally {
      setCameraStarting(false)
    }
  }

  const toggleMute = () => {
    const nextMuted = !muted
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted
    })
    setMuted(nextMuted)
  }

  // release the microphone and peer connections when leaving the page
  const leaveRef = useRef(leave)
  leaveRef.current = leave
  useEffect(() => () => leaveRef.current(), [])

  return {
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
  }
}
