import { useEffect, useMemo, useState } from "react"
import { apiFetch } from "../auth/api"

function norm(v) {
  return String(v ?? "").trim()
}

export default function Workers() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  // create form
  const [newName, setNewName] = useState("")
  const [newPhone, setNewPhone] = useState("")
  const [savingNew, setSavingNew] = useState(false)

  // filters
  const [q, setQ] = useState("")
  const [showInactive, setShowInactive] = useState(false)

  const [sortKey, setSortKey] = useState("name")
  const [sortDir, setSortDir] = useState("asc")


  // edit modal
  const [editOpen, setEditOpen] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editItem, setEditItem] = useState(null) // {id,name,phone,active}
  const [editName, setEditName] = useState("")
  const [editPhone, setEditPhone] = useState("")
  const [editActive, setEditActive] = useState(true)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch("/workers")
      const arr = Array.isArray(res) ? res : res?.value ?? res?.items ?? []
      setItems(arr)
    } catch (e) {
      setError(e?.message || "Nu pot încărca angajații.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

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
    const qq = norm(q).toLowerCase()
    return (items || [])
      .filter((w) => (showInactive ? true : (w.active ?? true)))
      .filter((w) => {
        if (!qq) return true
        const name = String(w.name || "").toLowerCase()
        const phone = String(w.phone || "").toLowerCase()
        return name.includes(qq) || phone.includes(qq) || String(w.id).includes(qq)
      })
      .sort((a, b) => {
        const dir = sortDir === "asc" ? 1 : -1

        if (sortKey === "active") {
          const aa = (a.active ?? true) ? 0 : 1
          const bb = (b.active ?? true) ? 0 : 1
          if (aa !== bb) return (aa - bb) * dir
          return String(a.name || "").localeCompare(String(b.name || ""), "ro") * dir
        }

        if (sortKey === "phone") {
          const c = String(a.phone || "").localeCompare(String(b.phone || ""), "ro")
          if (c !== 0) return c * dir
          return String(a.name || "").localeCompare(String(b.name || ""), "ro") * dir
        }

        // default name
        const c = String(a.name || "").localeCompare(String(b.name || ""), "ro")
        if (c !== 0) return c * dir
        return (Number(a.id) - Number(b.id)) * dir
      })
  }, [items, q, showInactive, sortKey, sortDir])

  async function createWorker(e) {
    e.preventDefault()
    const name = norm(newName)
    const phone = norm(newPhone)
    if (!name) {
      setError("Numele este obligatoriu.")
      return
    }
    setSavingNew(true)
    setError(null)
    setNotice(null)
    try {
      await apiFetch("/workers", {
        method: "POST",
        body: JSON.stringify({ name, phone }),
      })
      setNewName("")
      setNewPhone("")
      setNotice("Angajat adăugat.")
      await load()
    } catch (e2) {
      setError(e2?.message || "Nu pot adăuga angajatul.")
    } finally {
      setSavingNew(false)
    }
  }

  function openEdit(w) {
    setEditItem(w)
    setEditName(w?.name ?? "")
    setEditPhone(w?.phone ?? "")
    setEditActive(Boolean(w?.active ?? true))
    setEditOpen(true)
    setError(null)
    setNotice(null)
  }

  async function saveEdit(e) {
    e.preventDefault()
    if (!editItem?.id) return
    const name = norm(editName)
    const phone = norm(editPhone)
    if (!name) {
      setError("Numele este obligatoriu.")
      return
    }

    setEditSaving(true)
    setError(null)
    try {
      await apiFetch(`/workers/${editItem.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          phone: phone || null,
          active: Boolean(editActive),
        }),
      })
      setNotice("Angajat actualizat.")
      setEditOpen(false)
      setEditItem(null)
      await load()
    } catch (e2) {
      setError(e2?.message || "Nu pot salva modificările.")
    } finally {
      setEditSaving(false)
    }
  }

  async function toggleActive(w) {
    const nextActive = !(w.active ?? true)
    const msg = nextActive ? "Activezi angajatul?" : "Dezactivezi angajatul?"
    if (!confirm(msg)) return

    setError(null)
    setNotice(null)
    try {
      await apiFetch(`/workers/${w.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: nextActive }),
      })
      setNotice(nextActive ? "Angajat activat." : "Angajat dezactivat.")
      await load()
    } catch (e) {
      setError(e?.message || "Nu pot schimba statusul.")
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Angajați</h1>
          <div className="text-sm opacity-70">Creează, editează și dezactivează angajați (fără ștergere definitivă).</div>
        </div>
        <button
          onClick={load}
          className="rounded-xl bg-white/10 px-4 py-2 hover:bg-white/15"
        >
          Reîncarcă
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-200">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-green-200">
          {notice}
        </div>
      )}

      {/* Create */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="font-semibold mb-3">+ Adaugă angajat</div>
        <form onSubmit={createWorker} className="grid md:grid-cols-3 gap-3">
          <input
            className="px-3 py-2 rounded bg-black/20 outline-none"
            placeholder="Nume *"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            className="px-3 py-2 rounded bg-black/20 outline-none"
            placeholder="Telefon (opțional)"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
          />
          <button
            disabled={savingNew}
            className="rounded-xl px-4 py-2 font-semibold disabled:opacity-50"
            style={{ background: "var(--yellow)", color: "#000" }}
          >
            {savingNew ? "Salvez..." : "Adaugă"}
          </button>
        </form>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          className="px-3 py-2 rounded bg-black/20 outline-none w-full md:w-80"
          placeholder="Caută după nume / telefon / ID..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm opacity-90 select-none">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Afișează și inactivi
        </label>
        <div className="text-sm opacity-70">
          Total: <span className="font-semibold">{filtered.length}</span>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 font-semibold">Listă</div>

        {loading ? (
          <div className="p-4 opacity-70">Se încarcă…</div>
        ) : filtered.length === 0 ? (
          <div className="p-4 opacity-70">Nu există angajați.</div>
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
                    Nume{sortArrow("name")}
                  </th>
                  <th
                    className="text-center py-2 px-3 cursor-pointer select-none hover:text-white"
                    onClick={() => toggleSort("phone")}
                    title="Sortează după telefon"
                  >
                    Telefon{sortArrow("phone")}
                  </th>
                  <th
                    className="text-center py-2 px-3 cursor-pointer select-none hover:text-white"
                    onClick={() => toggleSort("active")}
                    title="Sortează după status"
                  >
                    Status{sortArrow("active")}
                  </th>
                  <th className="text-center py-2 px-3">Acțiuni</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((w) => {
                  const active = Boolean(w.active ?? true)
                  return (
                    <tr key={w.id} className="border-t border-white/5">
                      <td className={"py-2 px-3 text-center font-bold" + (active ? "" : "opacity-60")}>
                        {w.name}
                      </td>
                      <td className={"py-2 px-3 text-center" + (active ? "" : "opacity-60")}>
                        {w.phone || "-"}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {active ? (
                          <span className="text-xs px-2 py-1 rounded bg-green-500/15 border border-green-500/25 text-green-200">
                            ACTIV
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-1 rounded bg-white/10 border border-white/10 text-white/70">
                            INACTIV
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <button
                          onClick={() => openEdit(w)}
                          className="rounded-lg bg-white/10 px-3 py-1.5 hover:bg-white/15 mr-2"
                        >
                          Editează
                        </button>
                        <button
                          onClick={() => toggleActive(w)}
                          className="rounded-lg bg-white/10 px-3 py-1.5 hover:bg-white/15"
                        >
                          {active ? "Dezactivează" : "Activează"}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editOpen && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.65)" }}>
          <div className="w-full max-w-lg rounded-2xl p-5 border border-white/10" style={{ background: "var(--panel)" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: "var(--yellow)" }}>
                Editează angajat
              </h2>
              <button onClick={() => setEditOpen(false)} className="px-2 py-1 rounded bg-black">
                ✕
              </button>
            </div>

            <form onSubmit={saveEdit} className="space-y-3">
              <div>
                <label className="text-xs" style={{ color: "var(--muted)" }}>
                  Nume *
                </label>
                <input
                  className="w-full px-3 py-2 rounded bg-black/20 outline-none"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs" style={{ color: "var(--muted)" }}>
                  Telefon (opțional)
                </label>
                <input
                  className="w-full px-3 py-2 rounded bg-black/20 outline-none"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                />
              </div>

              <label className="flex items-center gap-2 text-sm select-none">
                <input
                  type="checkbox"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                />
                Activ
              </label>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="flex-1 px-3 py-2 rounded bg-black"
                >
                  Anulează
                </button>
                <button
                  disabled={editSaving}
                  type="submit"
                  className="flex-1 px-3 py-2 rounded font-semibold disabled:opacity-50"
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
