const URL_PATTERN = /((?:https?:\/\/)[^\s<>"']+)/gi

// Only allow http/https targets to avoid javascript: and other unsafe schemes.
function isSafeUrl(url) {
  try {
    const { protocol } = new URL(url)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

// Splits text into plain strings and clickable links, safe to render directly (no raw HTML injection).
export function linkify(text) {
  // Capturing group means split() interleaves matched URLs at odd indices.
  const parts = text.split(URL_PATTERN)

  return parts.map((part, i) => {
    const isUrlMatch = i % 2 === 1
    if (isUrlMatch && isSafeUrl(part)) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer">
          {part}
        </a>
      )
    }
    return part
  })
}
