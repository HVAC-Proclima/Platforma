import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { apiFetch } from "../auth/api"

function money(x) {
  const n = Number(x || 0)
  return `${n.toFixed(2)} RON`
}

function getCostForProject(p, costByProjectId) {
  return (
    costByProjectId.get(Number(p?.id)) ??
    Number(p?.materials_cost ?? p?.total_cost ?? p?.materials_total ?? p?.cost_materials ?? 0) ??
    0
  ) || 0
}

function labelStatus(s) {
  const v = String(s ?? "").trim().toLowerCase()

  switch (v) {
    case "planned":
    case "planuit":
    case "plănuit":
      return "Plănuit"

    case "in_progress":
    case "in progress":
    case "in_lucru":
    case "in lucru":
    case "în lucru":
      return "În lucru"

    case "done":
    case "finalizat":
      return "Finalizat"

    case "canceled":
    case "cancelled":
    case "anulat":
      return "Anulat"

    default:
      return s || "-"
  }
}

function norm(v) {
  return String(v ?? "").trim()
}

// NOTE: CRUD buttons are wired to API calls, but the backend endpoints can be added later.
// Page load only uses endpoints that already exist in your backend so it won't hang.
export default function ClientDetails() {
  const { id } = useParams()
  const clientID = Number(id)
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [client, setClient] = useState(null)
  const [projects, setProjects] = useState([])

  const [costByProjectId, setCostByProjectId] = useState(new Map())

  // toast/banner
  const [toast, setToast] = useState(null) // {type,msg}
  const toastTimer = useRef(null)
  function showToast(type, msg) {
    setToast({ type, msg })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2800)
  }

  // ===== client edit modal =====
  const [showEditClient, setShowEditClient] = useState(false)
  const [cName, setCName] = useState("")
  const [cType, setCType] = useState("")
  const [cCnp, setCCnp] = useState("")
  const [cPhone, setCPhone] = useState("")
  const [cEmail, setCEmail] = useState("")
  const [cAddress, setCAddress] = useState("")
  const [cNotes, setCNotes] = useState("")
  const [clientSaving, setClientSaving] = useState(false)

  // ===== project create/edit modal =====
  const [showEditProject, setShowEditProject] = useState(false)
  const [editProject, setEditProject] = useState(null) // null=create
  const [pTitle, setPTitle] = useState("")
  const [pAddress, setPAddress] = useState("")
  const [pStatus, setPStatus] = useState("planned")
  const [projectSaving, setProjectSaving] = useState(false)

  const [sortKey, setSortKey] = useState("title")
  const [sortDir, setSortDir] = useState("asc")

  const [q, setQ] = useState("")

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function sortArrow(key) {
    if (sortKey !== key) return ""
    return sortDir === "asc" ? " ▲" : " ▼"
  }

  const filtered = useMemo(() => {
    const qq = String(q ?? "").trim().toLowerCase()
    const rows = Array.isArray(projects) ? projects : []
  
    const out = rows.filter((p) => {
      if (!qq) return true
  
      const title = String(p?.title ?? "").toLowerCase()
      const status = String(p?.status ?? "").toLowerCase()
      const cost = getCostForProject(p, costByProjectId) // <-- COST REAL

      return (
        title.includes(qq) ||
        status.includes(qq) ||
        String(cost).includes(qq) ||
        money(cost).toLowerCase().includes(qq)
      )
    })
  
    const dir = sortDir === "desc" ? -1 : 1
    const key = sortKey || "title"
  
    out.sort((a, b) => {
      if (key === "cost") {
        const av = getCostForProject(a, costByProjectId)
        const bv = getCostForProject(b, costByProjectId)
        if (av !== bv) return (av - bv) * dir
        return String(a?.title ?? "").localeCompare(String(b?.title ?? ""), "ro") * dir
      }
  
      const av = String(a?.[key] ?? "")
      const bv = String(b?.[key] ?? "")
      const c = av.localeCompare(bv, "ro")
      if (c !== 0) return c * dir
  
      return String(a?.title ?? "").localeCompare(String(b?.title ?? ""), "ro") * dir
    })
  
    return out
  }, [projects, q, sortKey, sortDir, costByProjectId])
  

  // ===== load =====
  useEffect(() => {
    if (!clientID || Number.isNaN(clientID)) {
      setError("ID client invalid.")
      setLoading(false)
      return
    }

    let alive = true
    const ctrl = new AbortController()

    async function loadAll() {
      setLoading(true)
      setError(null)
      try {
        // only endpoints that exist now
        const [c, plist] = await Promise.all([
          apiFetch(`/clients/${clientID}`, { signal: ctrl.signal }),
          apiFetch(`/clients/${clientID}/projects`, { signal: ctrl.signal }),
        ])

        if (!alive) return

        const arr = Array.isArray(plist) ? plist : (plist?.value ?? [])
        setClient(c || null)
        setProjects(arr)

        // build costs map by project id (source of truth: /projects-materials/:projectId)
      const pairs = await Promise.all(
        arr.map(async (p) => {
          try {
            const pm = await apiFetch(`/projects-materials/${Number(p.id)}`,
              { signal: ctrl.signal }
            )
            const cost = Number(pm?.total_cost ?? pm?.total ?? 0) || 0
            return [Number(p.id), cost]
          } catch {
            return [Number(p.id), 0]
          }
        })
      )

      if (alive) setCostByProjectId(new Map(pairs))

        // prime edit modal fields
        setCName(c?.name || "")
        setCType(c?.type || "")
        setCCnp(c?.cnp || "")
        setCPhone(c?.phone || "")
        setCEmail(c?.email || "")
        setCAddress(c?.address || "")
        setCNotes(c?.notes || "")
      } catch (e) {
        if (!alive) return
        setError(e?.message || "Nu pot încărca clientul.")
      } finally {
        if (alive) setLoading(false)
      }
    }

    // hard timeout so we never hang forever
    const t = setTimeout(() => {
      try { ctrl.abort() } catch {}
    }, 12000)

    loadAll()

    return () => {
      alive = false
      clearTimeout(t)
      try { ctrl.abort() } catch {}
    }
  }, [clientID])

  const totalAllProjects = useMemo(() => {
    if (!projects?.length) return 0
    let sum = 0
    for (const p of projects) {
      const c =
        (costByProjectId.get(Number(p.id)) ??
          Number(p.materials_cost ?? p.total_cost ?? p.materials_total ?? p.cost_materials ?? 0)) || 0
      sum += c
    }
    return sum
  }, [projects, costByProjectId])

  function openEditClient() {
    setCName(client?.name || "")
    setCType(client?.type || "")
    setCCnp(client?.cnp || "")
    setCPhone(client?.phone || "")
    setCEmail(client?.email || "")
    setCAddress(client?.address || "")
    setCNotes(client?.notes || "")
    setShowEditClient(true)
  }

  function openCreateProject() {
    setEditProject(null)
    setPTitle("")
    setPAddress(client?.address || "")
    setPStatus("planned")
    setShowEditProject(true)
  }

  function openEditProjectModal(p) {
    setEditProject(p)
    setPTitle(p?.title || "")
    setPAddress(p?.address || "")
    setPStatus(p?.status || "planned")
    setShowEditProject(true)
  }

  async function saveClient(e) {
    e.preventDefault()
    if (clientSaving) return

    const body = {
      name: norm(cName),
      type: norm(cType) || null,
      cnp: norm(cCnp) || null,
      phone: norm(cPhone) || null,
      email: norm(cEmail) || null,
      address: norm(cAddress) || null,
      notes: norm(cNotes) || null,
    }
    if (!body.name) {
      showToast("err", "Numele clientului este obligatoriu.")
      return
    }

    setClientSaving(true)
    try {
      // if backend doesn't have it yet, it will show toast but won't break page
      const updated = await apiFetch(`/clients/${clientID}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      })
      setClient(updated || { ...(client || {}), ...body })
      showToast("ok", "Client actualizat.")
      setShowEditClient(false)
    } catch (e2) {
      showToast("err", e2?.message || "Nu pot salva clientul (încă).")
    } finally {
      setClientSaving(false)
    }
  }

  async function saveProject(e) {
    e.preventDefault()
    if (projectSaving) return

    const body = {
      title: norm(pTitle),
      address: norm(pAddress) || null,
      status: norm(pStatus) || "planned",
    }
    if (!body.title) {
      showToast("err", "Titlul lucrării este obligatoriu.")
      return
    }

    setProjectSaving(true)
    try {
      if (editProject?.id) {
        // update project
        const updated = await apiFetch(`/projects/${Number(editProject.id)}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        })
        //setProjects((prev) => prev.map((x) => (Number(x.id) === Number(editProject.id) ? (updated || { ...x, ...body }) : x)))
        showToast("ok", "Lucrare actualizată.")
      } else {
        // create project under client
        const created = await apiFetch(`/clients/${clientID}/projects`, {
          method: "POST",
          body: JSON.stringify(body),
        })
        /*if (created) {
          setProjects((prev) => [created, ...(prev || [])])
        }*/
        showToast("ok", "Lucrare creată.")
      }
      // refetch list (ca să ai created_at / cost etc)
      const plist2 = await apiFetch(`/clients/${clientID}/projects`)
      const arr2 = Array.isArray(plist2) ? plist2 : (plist2?.value ?? [])
      setProjects(arr2)
      setShowEditProject(false)
    } catch (e2) {
      showToast("err", e2?.message || "Operație proiect eșuată (încă).")
    } finally {
      setProjectSaving(false)
    }
  }

  async function cancelProject(p) {
    const pid = Number(p?.id)
    if (!pid) return
    if (!confirm(`Anulezi lucrarea "${p?.title || pid}"?`)) return

    try {
      // use status endpoint that exists
      await apiFetch(`/projects/${pid}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "canceled" }),
      })
      setProjects((prev) => prev.map((x) => (Number(x.id) === pid ? { ...x, status: "canceled" } : x)))
      showToast("ok", "Lucrare anulată.")
    } catch (e2) {
      showToast("err", e2?.message || "Nu pot anula lucrarea.")
    }
  }

  async function reload() {
    // simple reload via re-running effect logic
    // (kept explicit so buttons stay functional)
    setLoading(true)
    setError(null)
    try {
      const [c, plist] = await Promise.all([
        apiFetch(`/clients/${clientID}`),
        apiFetch(`/clients/${clientID}/projects`),
      ])
      const arr = Array.isArray(plist) ? plist : (plist?.value ?? [])
      setClient(c || null)
      setProjects(arr)
      showToast("ok", "Reîncărcat.")
    } catch (e) {
      setError(e?.message || "Nu pot reîncărca.")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="opacity-70">Se încarcă…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="mb-3 text-red-300">Eroare: {error}</div>
        <div className="flex gap-2">
          <button className="rounded-lg bg-white/10 px-3 py-2 hover:bg-white/15" onClick={() => navigate(-1)}>
            Înapoi
          </button>
          <button className="rounded-lg bg-white/10 px-3 py-2 hover:bg-white/15" onClick={reload}>
            Reîncearcă
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      {/* Toast */}
      {toast && (
        <div
          className={`rounded-xl px-4 py-2 border text-sm ${
            toast.type === "ok"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-100"
              : "bg-red-500/10 border-red-500/20 text-red-200"
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm opacity-70">
            <Link className="hover:underline" to="/clienti">
              Clienți
            </Link>
            <span className="opacity-50"> / </span>
            <span>{client?.name || `Client #${clientID}`}</span>
          </div>

          <h1 className="text-2xl font-semibold mt-2" style={{ color: "var(--yellow)" }}>
            {client?.name || `Client #${clientID}`}
          </h1>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <button onClick={() => navigate(-1)} className="rounded-xl bg-white/10 px-4 py-2 hover:bg-white/15">
            ← Înapoi
          </button>
          <button onClick={reload} className="rounded-xl bg-white/10 px-4 py-2 hover:bg-white/15">
            Reîncarcă
          </button>
          <button onClick={openEditClient} className="rounded-xl bg-white/10 px-4 py-2 hover:bg-white/15">
            Editează client
          </button>
          <button
            onClick={openCreateProject}
            className="
              group flex items-center gap-2
              px-4 py-1 rounded-lg text-lg
              font-medium
              bg-[var(--yellow)] text-black
              hover:bg-yellow-300
              transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-yellow-400/40
            "
          >
            <span className=" transition-all duration-200 group-hover:font-bold ">
              + Lucrare
            </span>
          </button>
        </div>
      </div>

      {/* Client cards */}
      <div className="grid md:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm opacity-70">Tip</div>
          <div className="font-semibold mt-1">{client?.type || "—"}</div>
          <div className="text-sm opacity-70 mt-3">CNP</div>
          <div className="font-semibold mt-1">{client?.cnp || "—"}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm opacity-70">Telefon</div>
          <div className="font-semibold mt-1">{client?.phone || "—"}</div>
          <div className="text-sm opacity-70 mt-3">Email</div>
          <div className="font-semibold mt-1">{client?.email || "—"}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm opacity-70">Adresă</div>
          <div className="font-semibold mt-1">{client?.address || "—"}</div>
          <div className="text-sm opacity-70 mt-3">Note</div>
          <div className="font-semibold mt-1 whitespace-pre-wrap">{client?.notes || "—"}</div>
        </div>
      </div>

      {/* Projects */}
      <div className="rounded-2xl border border-white/10 bg-white/5">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h2 className="font-semibold">Lucrări</h2>
          <div className="text-sm opacity-70">Total materiale (toate lucrările): {money(totalAllProjects)}</div>
        </div>

        <div className="p-4">
          {projects.length === 0 ? (
            <div className="opacity-70">Nu există lucrări pentru acest client.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-white/70">
                  <tr>
                  <th 
                    className="text-center py-2 px-3 cursor-pointer select-none hover:text-white"
                    onClick={() => toggleSort("title")}
                    title="Sortează după nume"
                  >
                    Titlu{sortArrow("title")}
                  </th>
                  <th 
                    className="text-center py-2 px-3 cursor-pointer select-none hover:text-white"
                    onClick={() => toggleSort("status")}
                    title="Sortează după status"
                  >
                    Status{sortArrow("status")}
                  </th>
                  <th 
                    className="text-center py-2 px-3 cursor-pointer select-none hover:text-white"
                    onClick={() => toggleSort("cost")}
                    title="Sortează după cost"
                  >
                    Cost materiale{sortArrow("cost")}
                  </th>
                    <th className="text-center py-2 px-3">Adresă</th>
                    <th className="text-center py-2 px-3">Creat</th>
                    <th className="text-center py-2 px-3">Acțiuni</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const cost =
                    (costByProjectId.get(Number(p.id)) ??
                      Number(p.materials_cost ?? p.total_cost ?? p.materials_total ?? p.cost_materials ?? 0)) || 0
                      return (
                      <tr key={p.id} className="border-t border-white/5">
                        <td className="py-2 px-3 text-center font-bold">
                          <Link className="hover:underline" to={`/clienti/${clientID}/lucrari/${p.id}`}>
                            {p.title || `Lucrare #${p.id}`}
                          </Link>
                        </td>
                        <td className="py-2 px-3 text-center">{labelStatus(p.status)}</td>
                        <td className="py-2 px-3 text-center">{money(cost)}</td>
                        <td className="py-2 px-3 text-center">{p.address || "—"}</td>
                        <td className="py-2 px-3 text-center">{p.created_at ? new Date(p.created_at).toLocaleString() : "—"}</td>
                        <td className="py-2 px-3 text-center">
                          <div className="inline-flex justify-center gap-2">
                            <button className="rounded-lg bg-white/10 px-3 py-1 hover:bg-white/15" onClick={() => openEditProjectModal(p)}>
                              Editează
                            </button>
                            <button className="rounded-lg bg-red-500/20 px-3 py-1 hover:bg-red-500/30 text-red-100" onClick={() => cancelProject(p)}>
                              Anulează
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ===== Edit client modal ===== */}
      {showEditClient && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.65)" }}>
          <div className="w-full max-w-2xl rounded-2xl p-5 border border-white/10" style={{ background: "var(--panel)" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: "var(--yellow)" }}>
                Editează client
              </h2>
              <button onClick={() => setShowEditClient(false)} className="px-2 py-1 rounded bg-black">
                ✕
              </button>
            </div>

            <form onSubmit={saveClient} className="space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs" style={{ color: "var(--muted)" }}>
                    Nume *
                  </label>
                  <input className="w-full px-3 py-2 rounded bg-black/20 outline-none" value={cName} onChange={(e) => setCName(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs" style={{ color: "var(--muted)" }}>
                    Tip
                  </label>
                  <input className="w-full px-3 py-2 rounded bg-black/20 outline-none" value={cType} onChange={(e) => setCType(e.target.value)} placeholder="PF / PJ" />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs" style={{ color: "var(--muted)" }}>
                    CNP
                  </label>
                  <input className="w-full px-3 py-2 rounded bg-black/20 outline-none" value={cCnp} onChange={(e) => setCCnp(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs" style={{ color: "var(--muted)" }}>
                    Telefon
                  </label>
                  <input className="w-full px-3 py-2 rounded bg-black/20 outline-none" value={cPhone} onChange={(e) => setCPhone(e.target.value)} />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs" style={{ color: "var(--muted)" }}>
                    Email
                  </label>
                  <input className="w-full px-3 py-2 rounded bg-black/20 outline-none" value={cEmail} onChange={(e) => setCEmail(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs" style={{ color: "var(--muted)" }}>
                    Adresă
                  </label>
                  <input className="w-full px-3 py-2 rounded bg-black/20 outline-none" value={cAddress} onChange={(e) => setCAddress(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="text-xs" style={{ color: "var(--muted)" }}>
                  Note
                </label>
                <textarea className="w-full px-3 py-2 rounded bg-black/20 outline-none min-h-[84px]" value={cNotes} onChange={(e) => setCNotes(e.target.value)} />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowEditClient(false)} className="flex-1 px-3 py-2 rounded bg-black">
                  Anulează
                </button>
                <button
                  disabled={clientSaving}
                  type="submit"
                  className="flex-1 px-3 py-2 rounded font-semibold"
                  style={{ background: "var(--yellow)", color: "#000" }}
                >
                  {clientSaving ? "Salvez..." : "Salvează"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== Create/Edit project modal ===== */}
      {showEditProject && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.65)" }}>
          <div className="w-full max-w-lg rounded-2xl p-5 border border-white/10" style={{ background: "var(--panel)" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: "var(--yellow)" }}>
                {editProject?.id ? "Editează lucrare" : "Lucrare nouă"}
              </h2>
              <button onClick={() => setShowEditProject(false)} className="px-2 py-1 rounded bg-black">
                ✕
              </button>
            </div>

            <form onSubmit={saveProject} className="space-y-3">
              <div>
                <label className="text-xs" style={{ color: "var(--muted)" }}>
                  Titlu *
                </label>
                <input className="w-full px-3 py-2 rounded bg-black/20 outline-none" value={pTitle} onChange={(e) => setPTitle(e.target.value)} />
              </div>

              <div>
                <label className="text-xs" style={{ color: "var(--muted)" }}>
                  Adresă
                </label>
                <input className="w-full px-3 py-2 rounded bg-black/20 outline-none" value={pAddress} onChange={(e) => setPAddress(e.target.value)} />
              </div>

              <div>
                <label className="text-xs" style={{ color: "var(--muted)" }}>
                  Status
                </label>
                <select className="w-full px-3 py-2 rounded bg-black/20 outline-none" value={pStatus} onChange={(e) => setPStatus(e.target.value)}>
                  <option value="planned">Plănuit</option>
                  <option value="in_progress">În lucru</option>
                  <option value="done">Finalizat</option>
                  <option value="canceled">Anulat</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowEditProject(false)} className="flex-1 px-3 py-2 rounded bg-black">
                  Anulează
                </button>
                <button
                  disabled={projectSaving}
                  type="submit"
                  className="flex-1 px-3 py-2 rounded font-semibold"
                  style={{ background: "var(--yellow)", color: "#000" }}
                >
                  {projectSaving ? "Salvez..." : "Salvează"}
                </button>
              </div>

              <div className="text-xs opacity-60">
                * Dacă unele endpoint-uri nu există încă în backend, vei vedea un mesaj de eroare, dar pagina rămâne funcțională.
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
