import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { apiFetch } from "../auth/api"

function norm(v) {
  return String(v ?? "").trim()
}

function pickClientPayload(form) {
  const type = form.type === "PJ" ? "PJ" : "PF"
  const name = norm(form.name)
  const phone = norm(form.phone) || null
  const email = norm(form.email) || null
  const address = norm(form.address) || null
  const note = norm(form.note) || null

  const cui = type === "PJ" ? (norm(form.cui) || null) : null
  const cnp = type === "PF" ? (norm(form.cnp) || null) : null

  return { name, type, phone, email, address, note, cui, cnp }
}

export default function Clients() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [q, setQ] = useState("")
  const [items, setItems] = useState([])

  // add modal
  const [showAdd, setShowAdd] = useState(false)
  const [addSaving, setAddSaving] = useState(false)
  const [addForm, setAddForm] = useState({
    name: "",
    type: "PF",
    phone: "",
    email: "",
    cnp: "",
    cui: "",
    address: "",
    note: "",
  })

  // edit modal
  const [showEdit, setShowEdit] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState({
    name: "",
    type: "PF",
    phone: "",
    email: "",
    cnp: "",
    cui: "",
    address: "",
    note: "",
  })

  // deactivate
  const [deactSavingId, setDeactSavingId] = useState(null)

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

  async function loadClients(search = "") {
    setLoading(true)
    setError(null)
    try {
      const url = search ? `/clients?q=${encodeURIComponent(search)}` : "/clients"
      const res = await apiFetch(url)
      const arr = Array.isArray(res) ? res : (res?.value ?? res?.items ?? [])
      setItems(arr)
    } catch (e) {
      setError(e?.message || "Nu pot încărca clienții.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadClients("")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      loadClients(norm(q))
    }, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const count = useMemo(() => (items?.length || 0), [items])

  function resetAdd() {
    setAddForm({
      name: "",
      type: "PF",
      phone: "",
      email: "",
      cnp: "",
      cui: "",
      address: "",
      note: "",
    })
  }

  const filtered = useMemo(() => {
    const qq = String(q ?? "").trim().toLowerCase()
    const rows = Array.isArray(items) ? items : []
  
    const out = rows.filter((c) => {
      if (!qq) return true
      return (
        String(c?.name ?? "").toLowerCase().includes(qq) ||
        String(c?.phone ?? "").toLowerCase().includes(qq) ||
        String(c?.type ?? "").toLowerCase().includes(qq)
      )
    })
  
    const dir = sortDir === "desc" ? -1 : 1
    const key = sortKey || "name"
  
    out.sort((a, b) => {
      const av = String(a?.[key] ?? "")
      const bv = String(b?.[key] ?? "")
      const c = av.localeCompare(bv, "ro")
      if (c !== 0) return c * dir
      return String(a?.name ?? "").localeCompare(String(b?.name ?? ""), "ro") * dir
    })
  
    return out
  }, [items, q, sortKey, sortDir])
  

  function openEdit(c) {
    setError(null)
    setEditId(Number(c.id))
    setEditForm({
      name: c.name ?? "",
      type: c.type === "PJ" ? "PJ" : "PF",
      phone: c.phone ?? "",
      email: c.email ?? "",
      cnp: c.cnp ?? "",
      cui: c.cui ?? "",
      address: c.address ?? "",
      note: c.note ?? "",
    })
    setShowEdit(true)
  }

  async function submitAdd(e) {
    e.preventDefault()
    setError(null)
    const payload = pickClientPayload(addForm)
    if (!payload.name) {
      setError("Numele clientului este obligatoriu.")
      return
    }
    if (payload.type === "PF" && payload.cnp && payload.cnp.length < 8) {
      setError("CNP pare prea scurt.")
      return
    }
    if (payload.type === "PJ" && payload.cui && payload.cui.length < 4) {
      setError("CUI pare prea scurt.")
      return
    }

    setAddSaving(true)
    try {
      await apiFetch("/clients", {
        method: "POST",
        body: JSON.stringify(payload),
      })
      setShowAdd(false)
      resetAdd()
      await loadClients(norm(q))
    } catch (e2) {
      setError(e2?.message || "Nu pot crea clientul.")
    } finally {
      setAddSaving(false)
    }
  }

  async function submitEdit(e) {
    e.preventDefault()
    if (!editId) return
    setError(null)

    const payload = pickClientPayload(editForm)
    if (!payload.name) {
      setError("Numele clientului este obligatoriu.")
      return
    }

    setEditSaving(true)
    try {
      await apiFetch(`/clients/${editId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      })
      setShowEdit(false)
      setEditId(null)
      await loadClients(norm(q))
    } catch (e2) {
      setError(e2?.message || "Nu pot salva modificările.")
    } finally {
      setEditSaving(false)
    }
  }

  async function deactivateClient(c) {
    const id = Number(c.id)
    if (!id) return
    const ok = window.confirm(`Dezactivezi clientul?\n\n${c?.name || ""}\n\n(Îl poți păstra în DB pentru rapoarte.)`)
    if (!ok) return

    setError(null)
    setDeactSavingId(id)
    try {
      // prefer soft-deactivate
      try {
        await apiFetch(`/clients/${id}/deactivate`, { method: "PATCH" })
      } catch (e1) {
        // fallback: try DELETE if backend doesn't have deactivate
        await apiFetch(`/clients/${id}`, { method: "DELETE" })
      }
      await loadClients(norm(q))
    } catch (e2) {
      setError(e2?.message || "Nu pot dezactiva/șterge clientul.")
    } finally {
      setDeactSavingId(null)
    }
  }

  if (loading) return <div className="p-6 opacity-70">Se încarcă…</div>

  return (
    <div className="p-6 space-y-5">
      {/* header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Clienți</h1>
          <div className="text-sm opacity-70">{count} clienți</div>
        </div>

        <button
          onClick={() => setShowAdd(true)}
          className="
            group flex items-center gap-2
            px-4 py-2 rounded-lg text-lg
            font-medium
            bg-[var(--yellow)] text-black
            hover:bg-yellow-300
            transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-yellow-400/40
          "
        >
          <span className=" transition-all duration-200 group-hover:font-bold ">
            + Client
          </span>
        </button>
      </div>

      {/* search + error */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center">
        <input
          className="w-full md:max-w-lg rounded-xl border border-white/10 bg-white/5 px-4 py-2 outline-none"
          placeholder="Caută după nume / telefon / CNP / CUI…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
            {error}
          </div>
        )}
      </div>

      {/* table */}
      <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-white/70 bg-white/5">
              <tr>
                <th 
                  className="text-center py-2 px-3 cursor-pointer select-none hover:text-white"
                  onClick={() => toggleSort("name")}
                  title="Sortează după name"
                >
                  Nume{sortArrow("name")}
                </th>
                <th 
                  className="text-center py-2 px-3 cursor-pointer select-none hover:text-white"
                  onClick={() => toggleSort("type")}
                  title="Sortează după tip"
                >
                  Tip{sortArrow("type")}
                </th>
                <th 
                  className="text-center py-2 px-3 cursor-pointer select-none hover:text-white"
                  onClick={() => toggleSort("phone")}
                  title="Sortează după name"
                >
                  Telefon{sortArrow("phone")}
                </th>
                <th className="text-centre px-4 py-3">CNP / CUI</th>
                <th className="text-centre px-4 py-3">Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-t border-white/10">
                  <td className="px-4 py-3 text-center font-bold">
                    <Link className="hover:underline" to={`/clienti/${c.id}`}>
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-center">{c.type === "PJ" ? "Firmă" : "PF"}</td>
                  <td className="px-4 py-3 text-center">{c.phone || "-"}</td>
                  <td className="px-4 py-3 text-center">{(c.type === "PJ" ? (c.cui || "-") : (c.cnp || "-"))}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Link
                        to={`/clienti/${c.id}`}
                        className="rounded-lg bg-white/10 px-3 py-1.5 hover:bg-white/15"
                      >
                        Detalii
                      </Link>
                      <button
                        onClick={() => openEdit(c)}
                        className="rounded-lg bg-white/10 px-3 py-1.5 hover:bg-white/15"
                      >
                        Editează
                      </button>
                      <button
                        disabled={deactSavingId === Number(c.id)}
                        onClick={() => deactivateClient(c)}
                        className="rounded-lg bg-red-500/15 px-3 py-1.5 hover:bg-red-500/20 disabled:opacity-60"
                      >
                        {deactSavingId === Number(c.id) ? "..." : "Dezactivează"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center opacity-70">
                    Nu există rezultate.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== Add modal ===== */}
      {showAdd && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.65)" }}>
          <div className="w-full max-w-2xl rounded-2xl p-5 border border-white/10" style={{ background: "var(--panel)" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: "var(--yellow)" }}>
                Client nou
              </h2>
              <button onClick={() => setShowAdd(false)} className="px-2 py-1 rounded bg-black">
                ✕
              </button>
            </div>

            <form onSubmit={submitAdd} className="space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs" style={{ color: "var(--muted)" }}>Nume *</label>
                  <input
                    className="w-full px-3 py-2 rounded bg-black/20 outline-none"
                    value={addForm.name}
                    onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <label className="text-xs" style={{ color: "var(--muted)" }}>Tip</label>
                  <select
                    className="w-full px-3 py-2 rounded bg-black/20 outline-none"
                    value={addForm.type}
                    onChange={(e) => setAddForm((p) => ({ ...p, type: e.target.value }))}
                  >
                    <option value="PF">Persoană fizică (PF)</option>
                    <option value="PJ">Firmă (PJ)</option>
                  </select>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs" style={{ color: "var(--muted)" }}>Telefon</label>
                  <input
                    className="w-full px-3 py-2 rounded bg-black/20 outline-none"
                    value={addForm.phone}
                    onChange={(e) => setAddForm((p) => ({ ...p, phone: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs" style={{ color: "var(--muted)" }}>Email (opțional)</label>
                  <input
                    className="w-full px-3 py-2 rounded bg-black/20 outline-none"
                    value={addForm.email}
                    onChange={(e) => setAddForm((p) => ({ ...p, email: e.target.value }))}
                  />
                </div>
              </div>

              {addForm.type === "PF" ? (
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs" style={{ color: "var(--muted)" }}>CNP (opțional)</label>
                    <input
                      className="w-full px-3 py-2 rounded bg-black/20 outline-none"
                      value={addForm.cnp}
                      onChange={(e) => setAddForm((p) => ({ ...p, cnp: e.target.value }))}
                    />
                  </div>
                  <div />
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs" style={{ color: "var(--muted)" }}>CUI (opțional)</label>
                    <input
                      className="w-full px-3 py-2 rounded bg-black/20 outline-none"
                      value={addForm.cui}
                      onChange={(e) => setAddForm((p) => ({ ...p, cui: e.target.value }))}
                    />
                  </div>
                  <div />
                </div>
              )}

              <div>
                <label className="text-xs" style={{ color: "var(--muted)" }}>Adresă (opțional)</label>
                <input
                  className="w-full px-3 py-2 rounded bg-black/20 outline-none"
                  value={addForm.address}
                  onChange={(e) => setAddForm((p) => ({ ...p, address: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-xs" style={{ color: "var(--muted)" }}>Notă (opțional)</label>
                <input
                  className="w-full px-3 py-2 rounded bg-black/20 outline-none"
                  value={addForm.note}
                  onChange={(e) => setAddForm((p) => ({ ...p, note: e.target.value }))}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 px-3 py-2 rounded bg-black">
                  Anulează
                </button>
                <button
                  disabled={addSaving}
                  type="submit"
                  className="flex-1 px-3 py-2 rounded font-semibold"
                  style={{ background: "var(--yellow)", color: "#000" }}
                >
                  {addSaving ? "Salvez..." : "Creează"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== Edit modal ===== */}
      {showEdit && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.65)" }}>
          <div className="w-full max-w-2xl rounded-2xl p-5 border border-white/10" style={{ background: "var(--panel)" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: "var(--yellow)" }}>
                Editează client
              </h2>
              <button onClick={() => setShowEdit(false)} className="px-2 py-1 rounded bg-black">
                ✕
              </button>
            </div>

            <form onSubmit={submitEdit} className="space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs" style={{ color: "var(--muted)" }}>Nume *</label>
                  <input
                    className="w-full px-3 py-2 rounded bg-black/20 outline-none"
                    value={editForm.name}
                    onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <label className="text-xs" style={{ color: "var(--muted)" }}>Tip</label>
                  <select
                    className="w-full px-3 py-2 rounded bg-black/20 outline-none"
                    value={editForm.type}
                    onChange={(e) => setEditForm((p) => ({ ...p, type: e.target.value }))}
                  >
                    <option value="PF">Persoană fizică (PF)</option>
                    <option value="PJ">Firmă (PJ)</option>
                  </select>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs" style={{ color: "var(--muted)" }}>Telefon</label>
                  <input
                    className="w-full px-3 py-2 rounded bg-black/20 outline-none"
                    value={editForm.phone}
                    onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs" style={{ color: "var(--muted)" }}>Email</label>
                  <input
                    className="w-full px-3 py-2 rounded bg-black/20 outline-none"
                    value={editForm.email}
                    onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                  />
                </div>
              </div>

              {editForm.type === "PF" ? (
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs" style={{ color: "var(--muted)" }}>CNP</label>
                    <input
                      className="w-full px-3 py-2 rounded bg-black/20 outline-none"
                      value={editForm.cnp}
                      onChange={(e) => setEditForm((p) => ({ ...p, cnp: e.target.value }))}
                    />
                  </div>
                  <div />
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs" style={{ color: "var(--muted)" }}>CUI</label>
                    <input
                      className="w-full px-3 py-2 rounded bg-black/20 outline-none"
                      value={editForm.cui}
                      onChange={(e) => setEditForm((p) => ({ ...p, cui: e.target.value }))}
                    />
                  </div>
                  <div />
                </div>
              )}

              <div>
                <label className="text-xs" style={{ color: "var(--muted)" }}>Adresă</label>
                <input
                  className="w-full px-3 py-2 rounded bg-black/20 outline-none"
                  value={editForm.address}
                  onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-xs" style={{ color: "var(--muted)" }}>Notă</label>
                <input
                  className="w-full px-3 py-2 rounded bg-black/20 outline-none"
                  value={editForm.note}
                  onChange={(e) => setEditForm((p) => ({ ...p, note: e.target.value }))}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowEdit(false)} className="flex-1 px-3 py-2 rounded bg-black">
                  Anulează
                </button>
                <button
                  disabled={editSaving}
                  type="submit"
                  className="flex-1 px-3 py-2 rounded font-semibold"
                  style={{ background: "var(--yellow)", color: "#000" }}
                >
                  {editSaving ? "Salvez..." : "Salvează"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
