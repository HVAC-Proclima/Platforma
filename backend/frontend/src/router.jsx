import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import Layout from "./layout/Layout"

import Stock from "./pages/Stock"
import Materials from "./pages/Materials"
import Clients from "./pages/Clients"
import ClientDetails from "./pages/ClientDetails"
import ProjectDetails from "./pages/ProjectDetails"
import Workers from "./pages/Workers"
import Users from "./pages/Users"
import Search from "./pages/Search"

function RequireAdmin({ children }) {
  let user = null
  try {
    user = JSON.parse(localStorage.getItem("user") || "null")
  } catch {
    user = null
  }

  if (!user) return <Navigate to="/login" replace />
  if (user.role !== "admin") return <Navigate to="/stoc" replace />

  return children
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/stoc" />} />
          <Route path="/search" element={<Search />} />
          <Route path="/stoc" element={<Stock />} />
          <Route path="/materiale" element={<Materials />} />
          <Route
            path="/angajati"
            element={
              <RequireAdmin>
                <Workers />
              </RequireAdmin>
            }
          />
          <Route path="/clienti" element={<Clients />} />
          <Route path="/clienti/:id" element={<ClientDetails />} />
          <Route
            path="/clienti/:clientId/lucrari/:projectId"
            element={<ProjectDetails />}
          />
          <Route
            path="/useri"
            element={
              <RequireAdmin>
                <Users />
              </RequireAdmin>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
