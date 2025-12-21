import { useState } from "react"
import { apiFetch } from "../auth/api"
import logo from "../assets/logo.png"

export default function Login({ onLogin }) {
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const data = await apiFetch("/login", {
        method: "POST",
        body: JSON.stringify({ phone, password }),
      })

      localStorage.setItem("token", data.token)
      if (data.user) {
        localStorage.setItem("user", JSON.stringify(data.user))
      }
      onLogin()
    } catch (err) {
      setError(err.message || "Eroare la login")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm p-6 rounded"
        style={{ background: "var(--panel)" }}
      >
        <div className="flex flex-col items-center mb-6">
          <img
            src={logo}
            alt="HVAC Proclima"
            className="h-30 mb-3"
          />
          <h1
            className="text-lg font-bold tracking-wide"
            style={{ color: "var(--yellow)" }}
          >
            Platformă de management
          </h1>
        </div>

        {error && (
          <div className="text-sm mb-3" style={{ color: "#f87171" }}>
            {error}
          </div>
        )}

        <input
          placeholder="Telefon"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          className="w-full mb-3 px-3 py-2 rounded bg-black/20 outline-none"
          required
        />

        <input
          type="password"
          placeholder="Parolă"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full mb-4 px-3 py-2 rounded bg-black/20 outline-none"
          required
        />

        <button
          disabled={loading}
          className="w-full py-2 rounded font-medium"
          style={{ background: "var(--yellow)", color: "#000" }}
        >
          {loading ? "Autentificare în progres..." : "Autentificare"}
        </button>
      </form>
    </div>
  )
}
