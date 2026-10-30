const DAY_MS = 24 * 60 * 60 * 1000

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

// "Today" for the current day, the weekday name within the last week, otherwise "dd/mm".
export function getDateLabel(timestamp) {
  const date = new Date(timestamp)
  const dayDiff = Math.round((startOfDay(new Date()) - startOfDay(date)) / DAY_MS)

  if (dayDiff === 0) return 'Today'
  if (dayDiff > 0 && dayDiff < 7) {
    return date.toLocaleDateString(undefined, { weekday: 'long' })
  }
  return date.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' })
}

export function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

// Groups by calendar day, returning [{ label, messages }] in original order.
export function groupMessagesByDay(messages) {
  const groups = []
  let currentKey = null

  for (const message of messages) {
    const date = new Date(message.timestamp)
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
    if (key !== currentKey) {
      groups.push({ label: getDateLabel(message.timestamp), messages: [] })
      currentKey = key
    }
    groups[groups.length - 1].messages.push(message)
  }

  return groups
}
