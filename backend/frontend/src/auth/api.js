const API_URL = "http://localhost:8080"

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("token")

  let res
  try {
    res = await fetch(API_URL + path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    })
  } catch (e) {
    // CORS / server down / network
    throw new Error("Nu pot ajunge la API (CORS sau server oprit)")
  }

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `API error (${res.status})`)
  }

  if (res.status === 204) return null
  return res.json()
}
