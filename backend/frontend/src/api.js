const API_URL = "https://platforma-production-4ff1.up.railway.app";

function getToken() {
  return localStorage.getItem("token")
}

async function apiFetch(path, options = {}) {
  const res = await fetch(API_URL + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      ...(options.headers || {}),
    },
  })

  if (!res.ok) {
    throw new Error(`API error ${res.status}`)
  }

  return res.json()
}

/* ===== STOCK ===== */
export const getStock = () => apiFetch("/stock")

/* ===== MATERIALE ===== */
export const getMaterials = (q = "") =>
  apiFetch(`/materials${q ? `?q=${encodeURIComponent(q)}` : ""}`)

/* ===== CLIENTI ===== */
export const getClients = () => apiFetch("/clients")
