import { useEffect, useRef, useState } from 'react'
import styles from './MessageInput.module.scss'

const EMOJIS = [
  '😀', '😂', '😊', '😍', '😎', '🤔', '😮', '😢',
  '😡', '👍', '👎', '👏', '🙏', '🔥', '🎉', '❤️',
  '💯', '✅', '❌', '😴', '🤯', '😅', '🥳', '🚀',
]

const GIF_SEARCH_DEBOUNCE_MS = 400

export default function MessageInput({ onSend }) {
  const [text, setText] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [gifQuery, setGifQuery] = useState('')
  const [gifResults, setGifResults] = useState([])
  const [gifLoading, setGifLoading] = useState(false)
  const [gifError, setGifError] = useState('')
  const pickerRef = useRef(null)
  const emojiButtonRef = useRef(null)
  const gifPickerRef = useRef(null)
  const gifButtonRef = useRef(null)

  useEffect(() => {
    if (!showEmojiPicker) return

    const handleClickOutside = (e) => {
      if (
        pickerRef.current?.contains(e.target) ||
        emojiButtonRef.current?.contains(e.target)
      ) {
        return
      }
      setShowEmojiPicker(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showEmojiPicker])

  useEffect(() => {
    if (!showGifPicker) return

    const handleClickOutside = (e) => {
      if (
        gifPickerRef.current?.contains(e.target) ||
        gifButtonRef.current?.contains(e.target)
      ) {
        return
      }
      setShowGifPicker(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showGifPicker])

  useEffect(() => {
    if (!showGifPicker) return
    const query = gifQuery.trim()
    if (!query) {
      setGifResults([])
      return undefined
    }

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setGifLoading(true)
      setGifError('')
      try {
        const res = await fetch(`/api/gifs/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        })
        const results = await res.json()
        if (!res.ok) throw new Error(results?.error || `Request failed: ${res.status}`)
        setGifResults(Array.isArray(results) ? results : [])
      } catch (err) {
        if (err.name === 'AbortError') return
        console.error('Failed to search gifs', err)
        setGifResults([])
        setGifError(err.message)
      } finally {
        setGifLoading(false)
      }
    }, GIF_SEARCH_DEBOUNCE_MS)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [gifQuery, showGifPicker])

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    onSend({ text: trimmed })
    setText('')
    setShowEmojiPicker(false)
  }

  const handleEmojiSelect = (emoji) => {
    setText((prev) => prev + emoji)
  }

  const handleGifSelect = (gif) => {
    onSend({ gifUrl: gif.url })
    setShowGifPicker(false)
    setGifQuery('')
    setGifResults([])
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.row}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          className={styles.input}
        />
        <button type="submit" className={styles.button}>
          Send
        </button>
      </div>
      <div className={styles.toolbar}>
        <button
          type="button"
          ref={emojiButtonRef}
          className={styles.emojiToggle}
          onClick={() => setShowEmojiPicker((prev) => !prev)}
          aria-label="Toggle emoji picker"
        >
          😊
        </button>
        {showEmojiPicker && (
          <div ref={pickerRef} className={styles.emojiPicker}>
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={styles.emojiOption}
                onClick={() => handleEmojiSelect(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          ref={gifButtonRef}
          className={styles.gifToggle}
          onClick={() => setShowGifPicker((prev) => !prev)}
          aria-label="Toggle gif picker"
        >
          GIF
        </button>
        {showGifPicker && (
          <div ref={gifPickerRef} className={styles.gifPicker}>
            <input
              type="text"
              value={gifQuery}
              onChange={(e) => setGifQuery(e.target.value)}
              placeholder="Search gifs..."
              className={styles.gifSearchInput}
              autoFocus
            />
            <div className={styles.gifResults}>
              {gifLoading && <span className={styles.gifStatus}>Searching...</span>}
              {!gifLoading && gifError && <span className={styles.gifStatus}>{gifError}</span>}
              {!gifLoading && !gifError && gifQuery.trim() && gifResults.length === 0 && (
                <span className={styles.gifStatus}>No gifs found</span>
              )}
              {gifResults.map((gif) => (
                <button
                  key={gif.id}
                  type="button"
                  className={styles.gifOption}
                  onClick={() => handleGifSelect(gif)}
                >
                  <img src={gif.previewUrl} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </form>
  )
}
