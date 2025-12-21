import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { apiFetch } from "../auth/api"

function money(x) {
  const n = Number(x || 0)
  return `${n.toFixed(2)} RON`
}

function labelStatus(s) {
  switch (s) {
    case "planned":
      return "Plănuit"
    case "in_progress":
      return "În lucru"
    case "done":
      return "Finalizat"
    case "canceled":
      return "Anulat"
    default:
      return s || "-"
  }
}


function showToast(setToast, type, msg) {
  if (!msg) return
  setToast({ type, msg, ts: Date.now() })
  setTimeout(() => setToast(null), 3500)
}

function norm(v) {
  return String(v ?? "").trim()
}

export default function ProjectDetails() {
  const { clientId, projectId } = useParams()
  const clientID = Number(clientId)
  const projectID = Number(projectId)
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [toast, setToast] = useState(null) // {type,msg}


  const [me, setMe] = useState(null) // {role, ...}
  const [client, setClient] = useState(null)
  const [project, setProject] = useState(null)

  const [materials, setMaterials] = useState(null) // {project_id, items, total_cost}
  const [workers, setWorkers] = useState([]) // list assigned to project
  const [locations, setLocations] = useState([]) // [{id,code,name,active}]

  const [statusSaving, setStatusSaving] = useState(false)

  // ===== stock (for available qty in consume modal) =====
  const [stockRows, setStockRows] = useState([]) // GET /stock
  // ===== banners / notices =====
  const [notice, setNotice] = useState(null) // {type:"ok"|"err", msg:string}

  // ===== edit consumed material (frontend-only until API exists) =====
  const [showEditConsumeItem, setShowEditConsumeItem] = useState(false)
  const [editConsumeItem, setEditConsumeItem] = useState(null) // {material_id,name,unit,qty,unit_price_snapshot,cost}
  const [editConsumeQty, setEditConsumeQty] = useState("")
  const [editConsumeUnitPrice, setEditConsumeUnitPrice] = useState("")

  // ===== consume modal =====
  const [showConsume, setShowConsume] = useState(false)
  const [consumeLocCode, setConsumeLocCode] = useState("ZOR")
  const [consumeQty, setConsumeQty] = useState("")
  const [consumeNote, setConsumeNote] = useState("")
  const [consumeUnitPrice, setConsumeUnitPrice] = useState("") // optional override
  const [consumeSaving, setConsumeSaving] = useState(false)

  // material autocomplete
  const [matQ, setMatQ] = useState("")
  const [matOptions, setMatOptions] = useState([])
  const [matLoading, setMatLoading] = useState(false)
  const [selectedMat, setSelectedMat] = useState(null) // {id,name,unit,price}
  const matDebounceRef = useRef(null)

  // ===== assign workers modal =====
  const [showAssign, setShowAssign] = useState(false)
  const [showEditWorker, setShowEditWorker] = useState(false)
  const [editWorker, setEditWorker] = useState(null) // {id,name,phone,note}
  const [editWorkerNote, setEditWorkerNote] = useState("")
  const [workerSaving, setWorkerSaving] = useState(false)

  const [workerQ, setWorkerQ] = useState("")
  const [workerOptions, setWorkerOptions] = useState([])
  const [workerLoading, setWorkerLoading] = useState(false)
  const [selectedWorkerIDs, setSelectedWorkerIDs] = useState(new Set())
  const [assignNote, setAssignNote] = useState("")
  const [assignSaving, setAssignSaving] = useState(false)
  const workerDebounceRef = useRef(null)

  const [sortKey, setSortKey] = useState("name")
  const [sortDir, setSortDir] = useState("asc")

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
    const rows = Array.isArray(materials?.items) ? materials.items : []
  
    // clonăm ca să NU sortăm direct state-ul
    const out = [...rows]
  
    const dir = sortDir === "desc" ? -1 : 1
    const key = sortKey || "name"
  
    out.sort((a, b) => {
      // numeric columns
      if (key === "qty" || key === "unit_price_snapshot" || key === "cost") {
        const av = Number(a?.[key] ?? 0)
        const bv = Number(b?.[key] ?? 0)
        if (av !== bv) return (av - bv) * dir
        return String(a?.name ?? "").localeCompare(String(b?.name ?? ""), "ro") * dir
      }
  
      // string column (name)
      const av = String(a?.[key] ?? "")
      const bv = String(b?.[key] ?? "")
      const c = av.localeCompare(bv, "ro")
      if (c !== 0) return c * dir
  
      return String(a?.name ?? "").localeCompare(String(b?.name ?? ""), "ro") * dir
    })
  
    return out
  }, [materials, sortKey, sortDir])
  
  const noticeTimerRef = useRef(null)
  function flash(type, msg) {
    setNotice({ type, msg })
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
    noticeTimerRef.current = setTimeout(() => setNotice(null), 3500)
  }


  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      const [meRes, c, plist, mats, w, locs, stockRes] = await Promise.all([
        apiFetch("/me"),
        apiFetch(`/clients/${clientID}`),
        apiFetch(`/clients/${clientID}/projects`),
        apiFetch(`/projects-materials/${projectID}`),
        apiFetch(`/projects/${projectID}/workers`),
        apiFetch(`/locations`),
        apiFetch(`/stock`),
      ])

      const p = (Array.isArray(plist) ? plist : (plist?.value ?? []))
        .find((x) => Number(x.id) === projectID)

      setMe(meRes)
      setClient(c)
      setProject(p || null)
      setMaterials(mats)
      setWorkers(Array.isArray(w) ? w : [])
      setLocations(Array.isArray(locs) ? locs : (locs?.value ?? []))
      const sr = Array.isArray(stockRes) ? stockRes : (stockRes?.value ?? stockRes?.items ?? [])
      setStockRows(sr)
    } catch (e) {
      setError(e?.message || "Nu pot încărca lucrarea.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!clientID || !projectID) return
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientID, projectID])

  const totalCost = useMemo(() => Number(materials?.total_cost || 0), [materials])

  const locCodeToID = useMemo(() => {
    const m = new Map()
    for (const l of locations || []) m.set(String(l.code).toUpperCase(), Number(l.id))
    return m
  }, [locations])


  const availableQty = useMemo(() => {
    if (!selectedMat?.id) return 0
    const locCode = String(consumeLocCode).toUpperCase()
    let sum = 0
    for (const r of stockRows || []) {
      if (
        Number(r.material_id) === Number(selectedMat.id) &&
        String(r.location_code).toUpperCase() === locCode
      ) {
        sum += Number(r.qty || 0)
      }
    }
    return sum
  }, [stockRows, selectedMat, consumeLocCode])

  function availableForMaterial(matId, locCode) {
    const code = String(locCode || "").toUpperCase()
    let sum = 0
    for (const r of stockRows || []) {
      if (
        Number(r.material_id) === Number(matId) &&
        String(r.location_code).toUpperCase() === code
      ) {
        sum += Number(r.qty || 0)
      }
    }
    return sum
  }

  async function updateStatus(next) {
    if (!next || statusSaving) return
    setStatusSaving(true)
    setError(null)
    try {
      await apiFetch(`/projects/${projectID}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      })
      setProject((prev) => (prev ? { ...prev, status: next } : prev))
    } catch (e) {
      setError(e?.message || "Nu pot schimba statusul.")
    } finally {
      setStatusSaving(false)
    }
  }

  // ===== material autocomplete =====
  useEffect(() => {
    if (!showConsume) return
    // clear previous
    setMatOptions([])
    setMatQ(selectedMat ? selectedMat.name : "")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showConsume])

  useEffect(() => {
    if (!showConsume) return
    ;(async () => {
      try {
        const stockRes = await apiFetch(`/stock`)
        const sr = Array.isArray(stockRes) ? stockRes : (stockRes?.value ?? stockRes?.items ?? [])
        setStockRows(sr)
      } catch {
        // ignore
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showConsume])

  useEffect(() => {
    if (!showConsume) return
    const q = norm(matQ)
    if (matDebounceRef.current) clearTimeout(matDebounceRef.current)
    matDebounceRef.current = setTimeout(async () => {
      if (!q) {
        setMatOptions([])
        return
      }
      setMatLoading(true)
      try {
        const res = await apiFetch(`/materials?q=${encodeURIComponent(q)}`)
        const arr = Array.isArray(res) ? res : (res?.value ?? res?.items ?? [])
        setMatOptions(arr.slice(0, 12))
      } catch {
        setMatOptions([])
      } finally {
        setMatLoading(false)
      }
    }, 200)
    return () => {
      if (matDebounceRef.current) clearTimeout(matDebounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matQ, showConsume])

  async function consumeSubmit(e) {
    e.preventDefault()
    if (!selectedMat?.id) {
      setError("Selectează un material.")
      return
    }
    const qty = Number(consumeQty)
    if (!qty || qty <= 0) {
      setError("Cantitatea trebuie să fie > 0.")
      return
    }
    if (availableQty <= 0) {
      setError("Stoc 0 pentru materialul selectat în locația aleasă.")
      return
    }
    if (qty > availableQty) {
      setError(`Stoc insuficient. Disponibil: ${availableQty.toFixed(2)} ${selectedMat?.unit || ""}`.trim())
      return
    }
    const fromID = locCodeToID.get(String(consumeLocCode).toUpperCase())
    if (!fromID) {
      setError("Locație invalidă.")
      return
    }

    const up = Number(consumeUnitPrice)
    const body = {
      project_id: projectID,
      material_id: Number(selectedMat.id),
      from_location_id: fromID,
      qty: qty,
      note: norm(consumeNote) || null,
    }
    if (consumeUnitPrice && up > 0) body.unit_price = up

    setConsumeSaving(true)
    setError(null)
    try {
      await apiFetch("/stock/consume", {
        method: "POST",
        body: JSON.stringify(body),
      })

      // refresh deviz + keep modal open? -> close for kiosk
      setShowConsume(false)
      setConsumeQty("")
      setConsumeNote("")
      setConsumeUnitPrice("")
      setSelectedMat(null)
      setMatQ("")
      setMatOptions([])

      const mats = await apiFetch(`/projects-materials/${projectID}`)
      setMaterials(mats)
      const stockRes = await apiFetch(`/stock`)
      const sr = Array.isArray(stockRes) ? stockRes : (stockRes?.value ?? stockRes?.items ?? [])
      setStockRows(sr)
    } catch (e2) {
      setError(e2?.message || "Consum eșuat.")
    } finally {
      setConsumeSaving(false)
    }
  }

  // ===== worker autocomplete + assign =====
  useEffect(() => {
    if (!showAssign) return
    setWorkerOptions([])
    setWorkerQ("")
    // preselect already assigned (optional)
    const set0 = new Set()
    for (const w of workers) set0.add(Number(w.id))
    setSelectedWorkerIDs(set0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAssign])

  useEffect(() => {
    if (!showAssign) return
    const q = norm(workerQ)
    if (workerDebounceRef.current) clearTimeout(workerDebounceRef.current)
    workerDebounceRef.current = setTimeout(async () => {
      setWorkerLoading(true)
      try {
        const url = q ? `/workers?q=${encodeURIComponent(q)}` : `/workers`
        const res = await apiFetch(url)
        const arr = Array.isArray(res) ? res : (res?.value ?? res?.items ?? [])
        setWorkerOptions(arr.slice(0, 20))
      } catch {
        setWorkerOptions([])
      } finally {
        setWorkerLoading(false)
      }
    }, 200)
    return () => {
      if (workerDebounceRef.current) clearTimeout(workerDebounceRef.current)
    }
  }, [workerQ, showAssign])

  function toggleWorker(id) {
    setSelectedWorkerIDs((prev) => {
      const next = new Set(prev)
      const nid = Number(id)
      if (next.has(nid)) next.delete(nid)
      else next.add(nid)
      return next
    })
  }

  async function assignSubmit(e) {
    e.preventDefault()
    if (me?.role !== "admin") {
      setError("Doar admin poate asigna angajați.")
      return
    }
    const ids = Array.from(selectedWorkerIDs).filter((x) => x > 0)
    if (!ids.length) {
      setError("Selectează cel puțin un angajat.")
      return
    }

    setAssignSaving(true)
    setError(null)
    try {
      await apiFetch(`/projects/${projectID}/workers`, {
        method: "POST",
        body: JSON.stringify({
          worker_ids: ids,
          note: norm(assignNote) || null,
        }),
      })
      setShowAssign(false)
      setAssignNote("")

      const w = await apiFetch(`/projects/${projectID}/workers`)
      setWorkers(Array.isArray(w) ? w : [])
    } catch (e2) {
      setError(e2?.message || "Asignare eșuată.")
    } finally {
      setAssignSaving(false)
    }
  }


  async function removeWorker(w) {
    if (!w?.id) return
    const wid = Number(w.id)
    setWorkerSaving(true)
    try {
      await apiFetch(`/projects/${projectID}/workers/${wid}`, { method: "DELETE" })
      showToast(setToast, "ok", "Angajat scos de pe lucrare.")
    } catch (e) {
      showToast(setToast, "warn", "Am scos din interfață (API de remove urmează).")
    } finally {
      setWorkers((prev) => (prev || []).filter((x) => Number(x.id) !== wid))
      setWorkerSaving(false)
    }
  }

  function openEditWorker(w) {
    setEditWorker(w)
    setEditWorkerNote(w?.note || "")
    setShowEditWorker(true)
  }

  async function saveWorkerNote(e) {
    e.preventDefault()
    if (!editWorker?.id || workerSaving) return
    const wid = Number(editWorker.id)
    const nextNote = norm(editWorkerNote) || null
    setWorkerSaving(true)
    try {
      await apiFetch(`/projects/${projectID}/workers/${wid}`, {
        method: "PATCH",
        body: JSON.stringify({ note: nextNote }),
      })
      showToast(setToast, "ok", "Notă actualizată.")
    } catch {
      showToast(setToast, "warn", "Notă actualizată local (API urmează).")
    } finally {
      setWorkers((prev) => (prev || []).map((x) => (Number(x.id) === wid ? { ...x, note: nextNote } : x)))
      setWorkerSaving(false)
      setShowEditWorker(false)
      setEditWorker(null)
      setEditWorkerNote("")
    }
  }

  if (loading) return <div className="p-6 opacity-70">Se încarcă…</div>

  if (error) {
    return (
      <div className="p-6">
        <div className="mb-3 text-red-300">Eroare: {error}</div>
        <button className="rounded-lg bg-white/10 px-3 py-2 hover:bg-white/15" onClick={() => navigate(-1)}>
          Înapoi
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {toast && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${toast.type === "ok" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100" : toast.type === "warn" ? "border-yellow-400/30 bg-yellow-400/10 text-yellow-100" : "border-red-500/30 bg-red-500/10 text-red-100"}`}
        >
          {toast.msg}
        </div>
      )}

      {notice && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            notice.type === "ok"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
              : "border-red-500/30 bg-red-500/10 text-red-100"
          }`}
        >
          {notice.msg}
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
            <Link className="hover:underline" to={`/clienti/${clientID}`}>
              {client?.name}
            </Link>
            <span className="opacity-50"> / </span>
            <span>Lucrare</span>
          </div>

          <h1 className="text-2xl font-semibold mt-2">{project?.title || `Lucrare #${projectID}`}</h1>
          <div className="mt-2 text-sm opacity-80">{project?.address ? <span>📍 {project.address}</span> : <span className="opacity-60">—</span>}</div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="text-sm opacity-70">Status</div>
          <select
            className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 outline-none"
            value={project?.status || "planned"}
            onChange={(e) => updateStatus(e.target.value)}
            disabled={!project || statusSaving}
          >
            <option value="planned">Plănuit</option>
            <option value="in_progress">În lucru</option>
            <option value="done">Finalizat</option>
            <option value="canceled">Anulat</option>
          </select>
          <div className="text-xs opacity-60">{project?.status ? labelStatus(project.status) : ""}</div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm opacity-70">Cost materiale (lucrare)</div>
          <div className="text-2xl font-semibold mt-1">{money(totalCost)}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm opacity-70">Angajați pe lucrare</div>
          <div className="text-2xl font-semibold mt-1">{workers.length}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm opacity-70">Creat</div>
          <div className="text-2xl font-semibold mt-1">{project?.created_at ? new Date(project.created_at).toLocaleDateString() : "—"}</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setShowConsume(true)}
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
            + Consumă material
          </span>
        </button>

        <button
          onClick={() => setShowAssign(true)}
          className="rounded-xl bg-white/10 px-4 py-2 hover:bg-white/15"
        >
          Asignează angajați
        </button>

        <button onClick={loadAll} className="rounded-xl bg-white/10 px-4 py-2 hover:bg-white/15">
          Reîncarcă
        </button>

        <Link to={`/clienti/${clientID}`} className="rounded-xl bg-white/10 px-4 py-2 hover:bg-white/15">
          Înapoi la client
        </Link>
      </div>

      {/* Workers table */}
      <div className="rounded-2xl border border-white/10 bg-white/5">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h2 className="font-semibold">Angajați</h2>
          <div className="text-xs opacity-60">{me?.role === "admin" ? "Admin: poți asigna din buton" : "Doar admin poate asigna"}</div>
        </div>

        <div className="p-4">
          {workers.length === 0 ? (
            <div className="opacity-70">Nu există angajați asignați.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-white/70">
                  <tr>
                    <th className="text-center py-2 px-3">Nume</th>
                    <th className="text-center py-2 px-3">Telefon</th>
                    <th className="text-center py-2 px-3">Notă</th>
                    <th className="text-center py-2 px-3">Adăugat</th>
                    <th className="text-center py-2 px-3">Acțiuni</th>
                  </tr>
                </thead>
                <tbody>
                  {workers.map((w) => (
                    <tr key={w.id} className="border-t border-white/5">
                      <td className="py-2 px-3 text-center font-bold">{w.name}</td>
                      <td className="py-2 px-3 text-center">{w.phone || "-"}</td>
                      <td className="py-2 px-3 text-center">{w.note || "-"}</td>
                      <td className="py-2 px-3 text-center">{w.added_at ? new Date(w.added_at).toLocaleString() : "-"}</td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          className="rounded-lg bg-white/10 px-3 py-1.5 hover:bg-white/15 mr-2"
                          onClick={() => openEditWorker(w)}
                          disabled={workerSaving}
                        >
                          Editează notă
                        </button>
                        <button
                          type="button"
                          className="rounded-lg bg-red-500/15 text-red-200 px-3 py-1.5 hover:bg-red-500/25"
                          onClick={() => removeWorker(w)}
                          disabled={workerSaving}
                        >
                          Scoate
                        </button>
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Materials deviz */}
      <div className="rounded-2xl border border-white/10 bg-white/5">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h2 className="font-semibold">Materiale consumate</h2>
          <div className="text-sm opacity-70">Total: {money(totalCost)}</div>
        </div>

        <div className="p-4">
          {!(materials?.items || []).length ? (
            <div className="opacity-70">Nu există consumuri pe această lucrare.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-white/70">
                  <tr>
                      <th 
                      className="text-center py-2 px-3 cursor-pointer select-none hover:text-white"
                      onClick={() => toggleSort("name")}
                      title="Sortează după nume"
                      >
                      Material{sortArrow("name")}
                    </th>
                    <th 
                      className="text-center py-2 px-3 cursor-pointer select-none hover:text-white"
                      onClick={() => toggleSort("qty")}
                      title="Sortează după qty"
                      >
                      Cantitate{sortArrow("qty")}
                    </th>
                    <th className="text-center py-2 px-3">UM</th>
                    <th 
                      className="text-center py-2 px-3 cursor-pointer select-none hover:text-white"
                      onClick={() => toggleSort("unit_price_snapshot")}
                      title="Sortează după unit_price_snapshot"
                      >
                      Preț unitar{sortArrow("unit_price_snapshot")}
                    </th>
                    <th 
                      className="text-center py-2 px-3 cursor-pointer select-none hover:text-white"
                      onClick={() => toggleSort("cost")}
                      title="Sortează după cost"
                      >
                      Valoare{sortArrow("cost")}
                    </th>
                    <th className="text-center py-2 px-3">Acțiuni</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((it) => (
                    <tr key={it.material_id} className="border-t border-white/5">
                      <td className="py-2 px-3 text-center font-bold">{it.name}</td>
                      <td className="py-2 px-3 text-center">{Number(it.qty || 0).toFixed(2)}</td>
                      <td className="py-2 px-3 text-center">{it.unit}</td>
                      <td className="py-2 px-3 text-center">{money(it.unit_price_snapshot)}</td>
                      <td className="py-2 px-3 text-center">{money(it.cost)}</td>
                      <td className="py-2 px-3 text-center">
                        <button
                          className="rounded-lg bg-white/10 px-2 py-1 hover:bg-white/15 mr-2"
                          type="button"
                          onClick={() => {
                            setEditConsumeItem(it)
                            setEditConsumeQty(String(it.qty ?? ""))
                            setEditConsumeUnitPrice(String(it.unit_price_snapshot ?? ""))
                            setShowEditConsumeItem(true)
                          }}
                        >
                          Editează
                        </button>
                        <button
                          className="rounded-lg bg-red-500/20 px-2 py-1 hover:bg-red-500/30"
                          type="button"
                          onClick={() => {
                            if (!window.confirm("Ștergi consumul pentru acest material? (Doar local, până adăugăm API-ul)")) return
                            setMaterials((prev) => {
                              const items = (prev?.items || []).filter((x) => Number(x.material_id) !== Number(it.material_id))
                              const total_cost = items.reduce((s, x) => s + Number(x.cost || 0), 0)
                              return prev ? { ...prev, items, total_cost } : prev
                            })
                            flash("ok", "Consum șters (doar în frontend).")
                          }}
                        >
                          Șterge
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ====== Consume modal (kiosk) ====== */}
      {showConsume && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.65)" }}>
          <div className="w-full max-w-lg rounded-2xl p-5 border border-white/10" style={{ background: "var(--panel)" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: "var(--yellow)" }}>
                Consumă material
              </h2>
              <button onClick={() => setShowConsume(false)} className="px-2 py-1 rounded bg-black">
                ✕
              </button>
            </div>

            <form onSubmit={consumeSubmit} className="space-y-3">
              {/* location */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConsumeLocCode("ZOR")}
                  className={`flex-1 px-3 py-2 rounded font-semibold ${consumeLocCode === "ZOR" ? "bg-yellow-400 text-black" : "bg-white/10"}`}
                >
                  Zorilor
                </button>
                <button
                  type="button"
                  onClick={() => setConsumeLocCode("IRS")}
                  className={`flex-1 px-3 py-2 rounded font-semibold ${consumeLocCode === "IRS" ? "bg-yellow-400 text-black" : "bg-white/10"}`}
                >
                  Iris
                </button>
              </div>

              {/* material autocomplete */}
              <div>
                <label className="text-xs" style={{ color: "var(--muted)" }}>
                  Material *
                </label>
                <input
                  className="w-full px-3 py-2 rounded bg-black/20 outline-none"
                  placeholder="Scrie ca să cauți…"
                  value={matQ}
                  onChange={(e) => {
                    setMatQ(e.target.value)
                    setSelectedMat(null)
                  }}
                />
                {matLoading && <div className="text-xs opacity-70 mt-1">Caut…</div>}

                {(matOptions?.length > 0) && (
                  <div className="mt-2 rounded border border-white/10 bg-black/40 max-h-56 overflow-auto">
                    {matOptions.map((m) => {
                      const avail = availableForMaterial(m.id, consumeLocCode)
                      const disabled = avail <= 0
                      return (
                        <button
                          type="button"
                          key={m.id}
                          disabled={disabled}
                          onClick={() => {
                            if (disabled) return
                            setSelectedMat(m)
                            setMatQ(m.name)
                            setMatOptions([])
                          }}
                          className={`w-full text-left px-3 py-2 ${disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-white/10"}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-semibold">{m.name}</div>
                            {disabled && (
                              <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-200 border border-red-500/30">
                                Fără stoc
                              </span>
                            )}
                          </div>
                          <div className="text-xs opacity-70">
                            {m.sku ? `SKU: ${m.sku} • ` : ""}UM: {m.unit || "-"} • Preț: {money(m.price)} •{" "}
                            <span className={avail > 0 ? "text-green-300" : "text-red-300"}>
                              Disponibil: {Number(avail || 0).toFixed(2)} {m.unit || ""}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}

                {selectedMat && (
                  <div className="text-xs opacity-80 mt-1">
                    Selectat: <span className="font-semibold">{selectedMat.name}</span>
                  </div>
                )}
              </div>

              {/* qty + unit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs" style={{ color: "var(--muted)" }}>
                    Cantitate *
                  </label>
                  <input
                    className="w-full px-3 py-2 rounded bg-black/20 outline-none"
                    inputMode="decimal"
                    value={consumeQty}
                    onChange={(e) => setConsumeQty(e.target.value)}
                    placeholder="ex: 5"
                  />
                  {selectedMat && (
                    <div className="mt-1 text-xs opacity-80">
                      Disponibil în {consumeLocCode === "ZOR" ? "Zorilor" : "Iris"}:{" "}
                      <span className="font-semibold">{Number(availableQty || 0).toFixed(2)}</span>{" "}
                      {selectedMat.unit || ""}
                    </div>
                  )}
                  {selectedMat && Number(consumeQty || 0) > Number(availableQty || 0) && (
                    <div className="mt-1 text-xs text-red-300">
                      Cantitatea depășește stocul disponibil.
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs" style={{ color: "var(--muted)" }}>
                    UM
                  </label>
                  <div className="w-full px-3 py-2 rounded bg-black/20 opacity-80">
                    {selectedMat?.unit || "—"}
                  </div>
                </div>
              </div>

              {/* unit price override */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs" style={{ color: "var(--muted)" }}>
                    Preț unitar (opțional)
                  </label>
                  <input
                    className="w-full px-3 py-2 rounded bg-black/20 outline-none"
                    inputMode="decimal"
                    value={consumeUnitPrice}
                    onChange={(e) => setConsumeUnitPrice(e.target.value)}
                    placeholder="lasă gol = din material"
                  />
                </div>
                <div>
                  <label className="text-xs" style={{ color: "var(--muted)" }}>
                    Notă (opțional)
                  </label>
                  <input
                    className="w-full px-3 py-2 rounded bg-black/20 outline-none"
                    value={consumeNote}
                    onChange={(e) => setConsumeNote(e.target.value)}
                    placeholder="ex: montaj baie"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConsume(false)}
                  className="flex-1 px-3 py-2 rounded bg-black"
                >
                  Anulează
                </button>
                <button
                  disabled={consumeSaving || !selectedMat?.id || Number(consumeQty || 0) <= 0 || Number(availableQty || 0) <= 0 || Number(consumeQty || 0) > Number(availableQty || 0)}
                  type="submit"
                  className="flex-1 px-3 py-2 rounded font-semibold"
                  style={{ background: "var(--yellow)", color: "#000" }}
                >
                  {consumeSaving ? "Salvez..." : "Consumă"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* ====== Edit worker note modal ====== */}
      {showEditWorker && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.65)" }}>
          <div className="w-full max-w-lg rounded-2xl p-5 border border-white/10" style={{ background: "var(--panel)" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: "var(--yellow)" }}>
                Notă angajat
              </h2>
              <button onClick={() => { setShowEditWorker(false); setEditWorker(null); }} className="px-2 py-1 rounded bg-black">
                ✕
              </button>
            </div>

            <div className="mb-3 text-sm opacity-80">
              {editWorker?.name ? <span className="font-semibold">{editWorker.name}</span> : "—"} {editWorker?.phone ? <span className="opacity-70">({editWorker.phone})</span> : null}
            </div>

            <form onSubmit={saveWorkerNote} className="space-y-3">
              <div>
                <label className="text-xs" style={{ color: "var(--muted)" }}>
                  Notă (opțional)
                </label>
                <input
                  className="w-full px-3 py-2 rounded bg-black/20 outline-none"
                  value={editWorkerNote}
                  onChange={(e) => setEditWorkerNote(e.target.value)}
                  placeholder="ex: echipa 1 / responsabil"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowEditWorker(false); setEditWorker(null); }}
                  className="flex-1 px-3 py-2 rounded bg-black"
                >
                  Anulează
                </button>
                <button
                  disabled={workerSaving}
                  type="submit"
                  className="flex-1 px-3 py-2 rounded font-semibold"
                  style={{ background: "var(--yellow)", color: "#000" }}
                >
                  {workerSaving ? "Salvez..." : "Salvează"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====== Assign workers modal ====== */}
      {showAssign && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.65)" }}>
          <div className="w-full max-w-2xl rounded-2xl p-5 border border-white/10" style={{ background: "var(--panel)" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: "var(--yellow)" }}>
                Asignează angajați
              </h2>
              <button onClick={() => setShowAssign(false)} className="px-2 py-1 rounded bg-black">
                ✕
              </button>
            </div>

            {me?.role !== "admin" && (
              <div className="mb-3 rounded bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-200">
                Doar admin poate asigna angajați.
              </div>
            )}

            <form onSubmit={assignSubmit} className="space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs" style={{ color: "var(--muted)" }}>
                    Caută angajat
                  </label>
                  <input
                    className="w-full px-3 py-2 rounded bg-black/20 outline-none"
                    value={workerQ}
                    onChange={(e) => setWorkerQ(e.target.value)}
                    placeholder="Scrie numele…"
                  />
                  {workerLoading && <div className="text-xs opacity-70 mt-1">Caut…</div>}
                </div>

                <div>
                  <label className="text-xs" style={{ color: "var(--muted)" }}>
                    Notă (opțional)
                  </label>
                  <input
                    className="w-full px-3 py-2 rounded bg-black/20 outline-none"
                    value={assignNote}
                    onChange={(e) => setAssignNote(e.target.value)}
                    placeholder="ex: echipa 1"
                  />
                </div>
              </div>

              <div className="rounded border border-white/10 bg-black/30 max-h-72 overflow-auto">
                {workerOptions.map((w) => {
                  const checked = selectedWorkerIDs.has(Number(w.id))
                  return (
                    <label key={w.id} className="flex items-center gap-3 px-3 py-2 border-t border-white/5 cursor-pointer hover:bg-white/5">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleWorker(w.id)}
                        disabled={me?.role !== "admin"}
                      />
                      <div className="flex-1">
                        <div className="font-semibold">{w.name}</div>
                        <div className="text-xs opacity-70">{w.phone ? `Tel: ${w.phone}` : "—"}</div>
                      </div>
                      <div className="text-xs opacity-60">ID: {w.id}</div>
                    </label>
                  )
                })}
                {!workerLoading && workerOptions.length === 0 && (
                  <div className="px-3 py-6 text-center opacity-70">Nu există rezultate.</div>
                )}
              </div>

              <div className="flex items-center justify-between text-sm opacity-80">
                <div>Selectați: {Array.from(selectedWorkerIDs).length}</div>
                <button
                  type="button"
                  className="px-3 py-2 rounded bg-white/10 hover:bg-white/15"
                  onClick={() => setSelectedWorkerIDs(new Set())}
                  disabled={me?.role !== "admin"}
                >
                  Deselectează tot
                </button>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowAssign(false)} className="flex-1 px-3 py-2 rounded bg-black">
                  Anulează
                </button>
                <button
                  disabled={assignSaving || me?.role !== "admin"}
                  type="submit"
                  className="flex-1 px-3 py-2 rounded font-semibold"
                  style={{ background: "var(--yellow)", color: "#000" }}
                >
                  {assignSaving ? "Salvez..." : "Asignează"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====== Edit consumed material modal (frontend-only for now) ====== */}
      {showEditConsumeItem && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.65)" }}>
          <div className="w-full max-w-lg rounded-2xl p-5 border border-white/10" style={{ background: "var(--panel)" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: "var(--yellow)" }}>
                Editează consum
              </h2>
              <button
                onClick={() => setShowEditConsumeItem(false)}
                className="px-2 py-1 rounded bg-black"
                type="button"
              >
                ✕
              </button>
            </div>

            <div className="text-sm opacity-80 mb-3">
              Material: <span className="font-semibold">{editConsumeItem?.name || "—"}</span>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                const qty = Number(editConsumeQty)
                if (!qty || qty <= 0) {
                  flash("err", "Cantitatea trebuie să fie > 0.")
                  return
                }
                const up = Number(editConsumeUnitPrice)
                if (!up || up <= 0) {
                  flash("err", "Prețul unitar trebuie să fie > 0.")
                  return
                }
                const mid = Number(editConsumeItem?.material_id)
                setMaterials((prev) => {
                  if (!prev) return prev
                  const items = (prev.items || []).map((x) => {
                    if (Number(x.material_id) !== mid) return x
                    const cost = qty * up
                    return { ...x, qty, unit_price_snapshot: up, cost }
                  })
                  const total_cost = items.reduce((s, x) => s + Number(x.cost || 0), 0)
                  return { ...prev, items, total_cost }
                })
                flash("ok", "Consum actualizat (doar în frontend).")
                setShowEditConsumeItem(false)
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs" style={{ color: "var(--muted)" }}>
                    Cantitate *
                  </label>
                  <input
                    className="w-full px-3 py-2 rounded bg-black/20 outline-none"
                    inputMode="decimal"
                    value={editConsumeQty}
                    onChange={(e) => setEditConsumeQty(e.target.value)}
                    placeholder="ex: 5"
                  />
                </div>

                <div>
                  <label className="text-xs" style={{ color: "var(--muted)" }}>
                    Preț unitar *
                  </label>
                  <input
                    className="w-full px-3 py-2 rounded bg-black/20 outline-none"
                    inputMode="decimal"
                    value={editConsumeUnitPrice}
                    onChange={(e) => setEditConsumeUnitPrice(e.target.value)}
                    placeholder="ex: 12"
                  />
                </div>
              </div>

              <div className="text-xs opacity-70">
                Notă: Editarea/ștergerea consumului va fi “definitivă” după ce adăugăm API (backend) pentru update/delete.
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditConsumeItem(false)}
                  className="flex-1 px-3 py-2 rounded bg-black"
                >
                  Anulează
                </button>
                <button
                  type="submit"
                  className="flex-1 px-3 py-2 rounded font-semibold"
                  style={{ background: "var(--yellow)", color: "#000" }}
                >
                  Salvează
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
