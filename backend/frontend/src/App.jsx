import { useEffect, useState } from "react"
import Layout from "./layout/Layout"
import Login from "./pages/Login"
import { apiFetch } from "./auth/api"
import AppRouter from "./router"

export default function App() {
  const [loading, setLoading] = useState(true)
  const [loggedIn, setLoggedIn] = useState(false)

  async function checkAuth() {
    const token = localStorage.getItem("token")
    if (!token) {
      setLoggedIn(false)
      setLoading(false)
      return
    }

    try {
      await apiFetch("/me")
      setLoggedIn(true)
    } catch {
      localStorage.removeItem("token")
      setLoggedIn(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkAuth()
  }, [])

  if (loading) return null

  if (!loggedIn) {
    return <Login onLogin={checkAuth} />
  }

  return <AppRouter />
}
