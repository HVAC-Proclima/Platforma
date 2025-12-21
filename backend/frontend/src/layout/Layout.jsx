import Sidebar from "./Sidebar"
import Topbar from "./Topbar"
import MobileTabBar from "./MobileTabBar"
import { Outlet } from "react-router-dom"

export default function Layout() {
  const user = JSON.parse(localStorage.getItem("user") || "null")

  function handleLogout() {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    window.location.replace("/#/login")
  }

  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg)", color: "var(--text)" }}>
      {/* Sidebar desktop */}
      <div className="hidden md:block">
        <Sidebar user={user}/>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        <Topbar user={user} onLogout={handleLogout}/>

        <main className="flex-1 p-4 md:p-6">
          <Outlet user={user}/>
        </main>

        {/* Tab bar mobil */}
        <div className="md:hidden">
          <MobileTabBar user={user} onLogout={handleLogout}/>
        </div>
      </div>
    </div>
  )
}