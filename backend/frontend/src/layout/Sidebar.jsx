import logo from "../assets/logo.png"
import { Link } from "react-router-dom"

export default function Sidebar({user}) {
  return (
    <aside
      className="w-64 h-screen p-4 flex flex-col"
      style={{ background: "var(--panel)" }}
    >
      <div className="flex items-center gap-3 mb-8">
        <img src={logo} alt="Proclima" className="h-12 w-12 object-contain" />
        <span className="font-bold" style={{ color: "var(--yellow)" }}>
          HVAC PROCLIMA
        </span>
      </div>

    <nav className="flex flex-col gap-2 text-sm">
      <Link
        to="/materiale"
        className="
          group flex items-center
          px-3 py-2 rounded
          opacity-90 hover:opacity-100
          hover:bg-black/20
          transition-colors
        "
      >
        <span          className="            font-medium          transition-all duration-200          group-hover:font-bold          group-hover:translate-x-1          "        >
          Materiale
        </span>
      </Link>

      <Link
        to="/stoc"
        className="
          group flex items-center
          px-3 py-2 rounded
          opacity-90 hover:opacity-100
          hover:bg-black/20
          transition-colors
        "
      >
        <span          className="            font-medium          transition-all duration-200          group-hover:font-bold          group-hover:translate-x-1          "        >
          Stoc
        </span>
      </Link>

      <Link
        to="/clienti"
        className="
          group flex items-center
          px-3 py-2 rounded
          opacity-90 hover:opacity-100
          hover:bg-black/20
          transition-colors
        "
      >
        <span          className="            font-medium          transition-all duration-200          group-hover:font-bold          group-hover:translate-x-1          "        >
          Clienți
        </span>
      </Link>

      {user?.role === "admin" && (
        <Link
          to="/angajati"
          className="
            group flex items-center
            px-3 py-2 rounded
            opacity-90 hover:opacity-100
            hover:bg-black/20
            transition-colors
            "
        >
        <span          className="            font-medium          transition-all duration-200          group-hover:font-bold          group-hover:translate-x-1          "        >
            Angajați
          </span>
        </Link>
      )}

      {user?.role === "admin" && (
        <Link
          to="/useri"
          className="
            group flex items-center
            px-3 py-2 rounded
            opacity-90 hover:opacity-100
            hover:bg-black/20
            transition-colors
          "
        >
        <span          className="            font-medium          transition-all duration-200          group-hover:font-bold          group-hover:translate-x-1          "        >
            Utilizatori
          </span>
        </Link>
      )}
    </nav>

      <div className="mt-auto text-xs text-gray-500">© HVAC Proclima</div>
    </aside>
  )
}
