// Parses a fetch Response as JSON, surfacing a clear error instead of a raw JSON.parse failure
// when the body is empty (e.g. the API server is unreachable and the dev proxy returns nothing).
export async function parseJsonResponse(res) {
  const text = await res.text()
  if (!text) {
    throw new Error('No response from server. Is the API running?')
  }
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('Unexpected response from server')
  }
}
