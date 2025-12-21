import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { apiFetch } from "../auth/api"

function money(x) {
  const n = Number(x || 0)
  return `${n.toFixed(2)} RON`
}

export default function ClientDetails() {
  const { id } = useParams()
  const clientID = Number(id)
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [client, setClient] = useState(null)
  const [projects, setProjects] = useState([])
  const [report, setReport] = useState(null)

  // modal add project
  const [showAdd, setShowAdd] = useState(false)
  const [title, setTitle] = useState("")
  const [address, setAddress] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      const [c, p, rep] = await Promise.all([
        apiFetch(`/clients/${clientID}`),
        apiFetch(`/clients/${clientID}/projects`),
        apiFetch(`/clients/${clientID}/report`),
      ])
      setClient(c)
      setProjects(Array.isArray(p) ? p : (p?.value ?? p?.items ?? []))
      setReport(rep)
    } catch (e) {
      setError(e.message || "Nu pot încărca detaliile clientului.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!clientID) return
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientID])

  const costByProjectId = useMemo(() => {
    const m = new Map()
    const items = report?.projects ?? []
    for (const it of items) m.set(Number(it.project_id), Number(it.cost || 0))
    return m
  }, [report])

  async function createProject(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await apiFetch(`/clients/${clientID}/projects`, {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          address: address.trim(),
          notes: notes.trim(),
        }),
      })
      setShowAdd(false)
      setTitle("")
      setAddress("")
      setNotes("")
      await loadAll()
    } catch (e2) {
      setError(e2.message || "Nu pot crea lucrarea.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-4 md:p-6" style={{ color: "var(--muted)" }}>Se încarcă…</div>
  }
  if (error) {
    return (
      <div className="p-4 md:p-6">
        <div className="mb-3" style={{ color: "#f87171" }}>{error}</div>
        <button onClick={() => navigate("/clienti")} className="px-3 py-2 rounded" style={{ background: "var(--panel)" }}>
          Înapoi la clienți
        </button>
      </div>
    )
  }

  const totalCost = Number(report?.total_cost || 0)

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => navigate("/clienti")}
          className="px-3 py-2 rounded text-sm"
          style={{ background: "var(--panel)" }}
        >
          ← Înapoi
        </button>

        <h1 className="text-xl font-semibold" style={{ color: "var(--yellow)" }}>
          {client?.name || "Client"}
        </h1>

        <div className="ml-auto text-sm opacity-80">
          Total materiale (toate lucrările):{" "}
          <span className="font-semibold opacity-100">{money(totalCost)}</span>
        </div>

        <button
          onClick={() => setShowAdd(true)}
          className="px-3 py-2 rounded text-sm font-medium"
          style={{ background: "var(--yellow)", color: "#000" }}
        >
          + Lucrare
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-4">
        <div className="rounded p-4" style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
          <div className="text-xs" style={{ color: "var(--muted)" }}>Tip</div>
          <div className="font-semibold">{client?.type || "-"}</div>
          <div className="mt-3 text-xs" style={{ color: "var(--muted)" }}>{client?.type === "PF" ? "CNP" : "CUI"}</div>
          <div className="font-semibold">{client?.type === "PF" ? (client?.cnp || "-") : (client?.cui || "-")}</div>
        </div>

        <div className="rounded p-4" style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
          <div className="text-xs" style={{ color: "var(--muted)" }}>Telefon</div>
          <div className="font-semibold">{client?.phone || "-"}</div>
          <div className="mt-3 text-xs" style={{ color: "var(--muted)" }}>Email</div>
          <div className="font-semibold">{client?.email || "-"}</div>
        </div>

        <div className="rounded p-4" style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
          <div className="text-xs" style={{ color: "var(--muted)" }}>Adresă</div>
          <div className="font-semibold">{client?.address || "-"}</div>
          <div className="mt-3 text-xs" style={{ color: "var(--muted)" }}>Note</div>
          <div className="opacity-90">{client?.notes || "-"}</div>
        </div>
      </div>

      <div className="overflow-x-auto rounded" style={{ background: "var(--panel)" }}>
        <div className="px-3 py-3 border-b border-white/10 flex items-center">
          <div className="font-semibold">Lucrări</div>
          <button onClick={loadAll} className="ml-auto px-3 py-2 rounded text-sm" style={{ background: "black" }}>
            Reîncarcă
          </button>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left opacity-90 border-b border-white/10">
              <th className="py-3 px-3">Titlu</th>
              <th className="py-3 px-3 text-center">Status</th>
              <th className="py-3 px-3">Adresă</th>
              <th className="py-3 px-3 text-center">Cost materiale</th>
              <th className="py-3 px-3 text-center">Creat</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => {
              const cost = costByProjectId.get(Number(p.id)) ?? 0
              return (
                <tr key={p.id} className="border-t border-white/5">
                  <td className="py-3 px-3 font-semibold"><Link className="hover:underline" to={`/clienti/${clientID}/lucrari/${p.id}`}>{p.title}</Link></td>
                  <td className="py-3 px-3 text-center">{p.status}</td>
                  <td className="py-3 px-3">{p.address || "-"}</td>
                  <td className="py-3 px-3 text-center">{money(cost)}</td>
                  <td className="py-3 px-3 text-center">
                    {p.created_at ? new Date(p.created_at).toLocaleString() : "-"}
                  </td>
                </tr>
              )
            })}

            {projects.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center opacity-70">
                  Nu există lucrări.
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
                Creează lucrare
              </h2>
              <button onClick={() => setShowAdd(false)} className="px-2 py-1 rounded" style={{ background: "black" }}>
                ✕
              </button>
            </div>

            <form onSubmit={createProject} className="space-y-3">
              <div>
                <label className="text-xs" style={{ color: "var(--muted)" }}>Titlu *</label>
                <input className="w-full px-3 py-2 rounded bg-black/20 outline-none" value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>

              <div>
                <label className="text-xs" style={{ color: "var(--muted)" }}>Adresă</label>
                <input className="w-full px-3 py-2 rounded bg-black/20 outline-none" value={address} onChange={(e) => setAddress(e.target.value)} />
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
                  {saving ? "Salvez..." : "Creează"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
