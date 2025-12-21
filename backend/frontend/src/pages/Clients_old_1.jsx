import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { apiFetch } from "../auth/api"

export default function Clients() {
  const navigate = useNavigate()

  const [items, setItems] = useState([])
  const [q, setQ] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // modal add
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState("")
  const [type, setType] = useState("PF") // PF / PJ
  const [cnp, setCnp] = useState("")
  const [cui, setCui] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  async function load(query) {
    setLoading(true)
    setError(null)
    try {
      const url = query?.trim()
        ? `/clients?q=${encodeURIComponent(query.trim())}`
        : "/clients"
      const data = await apiFetch(url)
      const arr = Array.isArray(data) ? data : (data?.value ?? data?.items ?? [])
      setItems(arr)
    } catch (e) {
      setError(e.message || "Nu pot încărca clienții.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(() => load(q), 250)
    return () => clearTimeout(t)
  }, [q])

  async function createClient(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await apiFetch("/clients", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          type,
          cnp: type === "PF" ? (cnp.trim() || null) : null,
          cui: type === "PJ" ? (cui.trim() || null) : null,
          phone: phone.trim() || null,
          address: address.trim() || null,
          notes: notes.trim() || null,
        }),
      })

      setShowAdd(false)
      setName("")
      setCnp("")
      setCui("")
      setPhone("")
      setAddress("")
      setNotes("")
      await load(q)
    } catch (e2) {
      setError(e2.message || "Nu pot salva clientul.")
    } finally {
      setSaving(false)
    }
  }

  const rows = useMemo(() => items, [items])

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-xl font-semibold" style={{ color: "var(--yellow)" }}>
          Clienți
        </h1>

        <button
          onClick={() => load(q)}
          className="px-3 py-2 rounded text-sm"
          style={{ background: "var(--panel)" }}
        >
          Reîncarcă
        </button>

        <button
          onClick={() => setShowAdd(true)}
          className="px-3 py-2 rounded text-sm font-medium"
          style={{ background: "var(--yellow)", color: "#000" }}
        >
          + Adaugă client
        </button>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Caută client (nume / CNP / CUI)…"
        className="w-full md:w-96 px-3 py-2 rounded bg-black/20 outline-none mb-4"
      />

      {loading && <div style={{ color: "var(--muted)" }}>Se încarcă…</div>}
      {error && <div style={{ color: "#f87171" }}>{error}</div>}

      <div className="overflow-x-auto rounded" style={{ background: "var(--panel)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left opacity-90 border-b border-white/10">
              <th className="py-3 px-3">Nume</th>
              <th className="py-3 px-3 text-center">Tip</th>
              <th className="py-3 px-3 text-center">CNP / CUI</th>
              <th className="py-3 px-3 text-center">Telefon</th>
              <th className="py-3 px-3">Adresă</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr
                key={c.id}
                className="border-t border-white/5 hover:bg-black/10 cursor-pointer"
                onClick={() => navigate(`/clienti/${c.id}`)}
                title="Deschide detalii"
              >
                <td className="py-3 px-3 font-semibold">{c.name}</td>
                <td className="py-3 px-3 text-center">{c.type}</td>
                <td className="py-3 px-3 text-center">
                  {c.type === "PF" ? (c.cnp || "-") : (c.cui || "-")}
                </td>
                <td className="py-3 px-3 text-center">{c.phone || "-"}</td>
                <td className="py-3 px-3">{c.address || "-"}</td>
              </tr>
            ))}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center opacity-70">
                  Nu există rezultate.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="w-full max-w-lg rounded p-5" style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: "var(--yellow)" }}>
                Adaugă client
              </h2>
              <button onClick={() => setShowAdd(false)} className="px-2 py-1 rounded" style={{ background: "black" }}>
                ✕
              </button>
            </div>

            <form onSubmit={createClient} className="space-y-3">
              <div>
                <label className="text-xs" style={{ color: "var(--muted)" }}>Nume *</label>
                <input className="w-full px-3 py-2 rounded bg-black/20 outline-none" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs" style={{ color: "var(--muted)" }}>Tip</label>
                  <select className="w-full px-3 py-2 rounded bg-black/20 outline-none" value={type} onChange={(e) => setType(e.target.value)}>
                    <option value="PF">PF</option>
                    <option value="PJ">PJ</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs" style={{ color: "var(--muted)" }}>{type === "PF" ? "CNP" : "CUI"}</label>
                  <input
                    className="w-full px-3 py-2 rounded bg-black/20 outline-none"
                    value={type === "PF" ? cnp : cui}
                    onChange={(e) => type === "PF" ? setCnp(e.target.value) : setCui(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs" style={{ color: "var(--muted)" }}>Telefon</label>
                  <input className="w-full px-3 py-2 rounded bg-black/20 outline-none" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs" style={{ color: "var(--muted)" }}>Adresă</label>
                  <input className="w-full px-3 py-2 rounded bg-black/20 outline-none" value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="text-xs" style={{ color: "var(--muted)" }}>Note</label>
                <input className="w-full px-3 py-2 rounded bg-black/20 outline-none" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 px-3 py-2 rounded" style={{ background: "black" }}>
                  Anulează
                </button>
                <button disabled={saving} type="submit" className="flex-1 px-3 py-2 rounded font-medium" style={{ background: "var(--yellow)", color: "#000" }}>
                  {saving ? "Salvez..." : "Salvează"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
