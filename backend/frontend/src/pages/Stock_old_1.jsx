import { useEffect, useState } from "react"
import { apiFetch } from "../auth/api"
import { fmtRON } from "../utils/money"
import { Link } from "react-router-dom"

export default function Stock() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)


  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch("/stock")
      // backend poate returna fie array direct, fie obiect cu {value: [...]}
      const rows = Array.isArray(data) ? data : (data.value || [])
      setItems(rows)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  if (loading) return <div>Se încarcă stocul...</div>
  if (error) return <div style={{ color: "#f87171" }}>{error}</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold" style={{ color: "var(--yellow)" }}>
          Stoc
        </h1>

        <Link
          to="/materiale"
          className="px-3 py-2 rounded text-sm"
          style={{ background: "var(--panel)" }}
        >
          ← Materiale
        </Link>
      </div>

      <button
        onClick={load}
        className="mb-4 px-4 py-2 rounded text-sm"
        style={{ background: "var(--panel)" }}
      >
        Reîncarcă
      </button>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            <th className="py-2 text-center">Material</th>
            <th className="py-2 text-center">Cantitate</th>
            <th className="py-2 text-center">Unitate</th>
            <th className="py-2 text-center">Preț</th>
            <th className="py-2 text-center">Valoare</th>
            <th className="py-2 text-center">Locație</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row, i) => (
            <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
              <td className="py-2 text-center font-bold">{row.material_name}</td>
              <td className="py-2 text-center font-semibold">{row.qty}</td>
              <td className="py-2 text-center">{row.unit}</td>
              <td className="py-2 text-center">{fmtRON(row.unit_price)}</td>
              <td className="py-2 text-center font-semibold">{fmtRON(row.total_value)}</td>
              <td className="py-2 text-center">{row.location_name}</td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </div>
  )
}
