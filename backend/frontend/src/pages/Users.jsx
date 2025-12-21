import React, { useEffect, useMemo, useState } from "react"
import { apiFetch } from "../auth/api"

function norm(x) {
  return String(x ?? "").trim()
}

function yn(v) {
  return v === true || v === 1 || v === "1" || v === "true"
}

function isAdmin(me) {
  const role = String(me?.role ?? me?.user_role ?? me?.userRole ?? "").toLowerCase()
  return yn(me?.is_admin) || yn(me?.isAdmin) || role === "admin"
}

function safeLower(x) {
  return String(x ?? "").toLowerCase()
}

function cmp(a, b) {
  if (a == null && b == null) return 0
  if (a == null) return -1
  if (b == null) return 1

  const an = Number(a)
  const bn = Number(b)
  const aIsNum = Number.isFinite(an) && String(a).trim() !== ""
  const bIsNum = Number.isFinite(bn) && String(b).trim() !== ""
  if (aIsNum && bIsNum) return an - bn

  const ad = new Date(a)
  const bd = new Date(b)
  if (!Number.isNaN(ad.valueOf()) && !Number.isNaN(bd.valueOf())) {
    return ad.valueOf() - bd.valueOf()
  }

  return String(a).localeCompare(String(b), "ro", { sensitivity: "base" })
}

function Toast({ toast, onClose }) {
  if (!toast) return null
  const isErr = toast.type === "err"
  return (
    <div className="fixed top-4 right-4 z-50">
      <div className={`rounded-xl px-4 py-3 shadow-lg border ${isErr ? "bg-red-500/10 border-red-500/30" : "bg-emerald-500/10 border-emerald-500/30"}`}>
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 text-sm font-semibold ${isErr ? "text-red-200" : "text-emerald-200"}`}>
            {isErr ? "Eroare" : "OK"}
          </div>
          <div className="text-white/90 text-sm max-w-[420px]">{toast.msg}</div>
          <button
            onClick={onClose}
            className="ml-2 rounded-lg bg-white/10 hover:bg-white/15 px-2 py-1 text-white/80"
            title="Închide"
            type="button"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Users({ user }) {
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  const [all, setAll] = useState([]) // raw from API
  const [q, setQ] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL") // ALL | ACTIVE | INACTIVE
  const [roleFilter, setRoleFilter] = useState("ALL") // ALL | admin | user | manager | ...

  const [sortKey, setSortKey] = useState("name")
  const [sortDir, setSortDir] = useState("asc")

  const [toast, setToast] = useState(null) // {type,msg}

  // create / edit modal
  const [showEdit, setShowEdit] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [saving, setSaving] = useState(false)

  const [uName, setUName] = useState("")
  const [uEmail, setUEmail] = useState("")
  const [uRole, setURole] = useState("user")
  const [uActive, setUActive] = useState(true)
  const [uPassword, setUPassword] = useState("") // create / reset
  const [uPhone, setUPhone] = useState("")

  function showToast(type, msg) {
    setToast({ type, msg })
    window.clearTimeout(showToast._t)
    showToast._t = window.setTimeout(() => setToast(null), 3500)
  }

  async function load() {
    setLoading(true)
    setErr(null)
    try {
      const meRes = await apiFetch("/me") // <- în loc de /users
  
      // /me returnează { user_id, name, role, ... }
      // mapăm la formatul pe care îl așteaptă tabelul tău
      const one = {
        id: meRes?.user_id ?? meRes?.id,
        name: meRes?.name,
        role: meRes?.role,
        active: true,
        email: meRes?.email ?? user?.email ?? user?.username ?? "",
        phone: meRes?.phone ?? user?.phone ?? user?.telefon ?? user?.phone_number ?? "",
      }
  
      setAll(one.id ? [one] : [])
    } catch (e) {
      setErr(e?.message || "Nu pot încărca /me.")
      setAll([])
    } finally {
      setLoading(false)
    }
  }
  

  useEffect(() => {
    load()
  }, [])

  const rolesInData = useMemo(() => {
    const s = new Set()
    for (const u of all || []) {
      const r = String(u?.role ?? u?.user_role ?? u?.userRole ?? "").trim()
      if (r) s.add(r)
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, "ro", { sensitivity: "base" }))
  }, [all])

  const rows = useMemo(() => {
    const qq = safeLower(q)
    const filtered = (all || []).filter((u) => {
      const name = safeLower(u?.name ?? u?.full_name ?? u?.fullname ?? "")
      const email = safeLower(u?.email ?? u?.username ?? "")
      const phone = safeLower(u?.phone ?? u?.telefon ?? "")
      const role = safeLower(u?.role ?? u?.user_role ?? u?.userRole ?? "")

      const activeVal = u?.active
      const active = activeVal === undefined ? !yn(u?.disabled) : yn(activeVal)

      if (statusFilter === "ACTIVE" && !active) return false
      if (statusFilter === "INACTIVE" && active) return false
      if (roleFilter !== "ALL" && role !== safeLower(roleFilter)) return false

      if (!qq) return true
      return name.includes(qq) || email.includes(qq) || phone.includes(qq) || role.includes(qq)
    })

    const sorted = filtered.slice().sort((a, b) => {
      const va = a?.[sortKey]
      const vb = b?.[sortKey]

      // some aliases
      const aName = a?.name ?? a?.full_name ?? a?.fullname
      const bName = b?.name ?? b?.full_name ?? b?.fullname
      const aRole = a?.role ?? a?.user_role ?? a?.userRole
      const bRole = b?.role ?? b?.user_role ?? b?.userRole
      const aEmail = a?.email ?? a?.username
      const bEmail = b?.email ?? b?.username

      let aa = va
      let bb = vb
      if (sortKey === "name") {
        aa = aName
        bb = bName
      } else if (sortKey === "email") {
        aa = aEmail
        bb = bEmail
      } else if (sortKey === "role") {
        aa = aRole
        bb = bRole
      } else if (sortKey === "active") {
        const aActive = a?.active === undefined ? !yn(a?.disabled) : yn(a?.active)
        const bActive = b?.active === undefined ? !yn(b?.disabled) : yn(b?.active)
        aa = aActive ? 1 : 0
        bb = bActive ? 1 : 0
      }

      const c = cmp(aa, bb)
      return sortDir === "asc" ? c : -c
    })

    return sorted
  }, [all, q, statusFilter, roleFilter, sortKey, sortDir])

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  function sortArrow(key) {
    if (sortKey !== key) return ""
    return sortDir === "asc" ? " ▲" : " ▼"
  }

  function openCreate() {
    setEditUser(null)
    setUName("")
    setUEmail("")
        setUPhone("")
setURole("user")
    setUActive(true)
    setUPassword("")
    setShowEdit(true)
  }

  function openEdit(u) {
    setEditUser(u)
    setUName(String(u?.name ?? u?.full_name ?? u?.fullname ?? ""))
    setUEmail(String(u?.email ?? u?.username ?? ""))
    setUPhone(String(u?.phone ?? u?.telefon ?? ""))
    setURole(String(u?.role ?? u?.user_role ?? u?.userRole ?? "user") || "user")
    const activeVal = u?.active
    const active = activeVal === undefined ? !yn(u?.disabled) : yn(activeVal)
    setUActive(active)
    setUPassword("")
    setShowEdit(true)
  }

  async function saveUser(e) {
    e?.preventDefault?.()
    if (saving) return

    const body = {
      name: norm(uName),
      phone: norm(uPhone),
      email: norm(uEmail) || undefined,
      role: norm(uRole) || "user",
      active: yn(uActive),
    }

    if (!body.name) {
      showToast("err", "Numele este obligatoriu.")
      return
    }
    if (!body.phone) {
      showToast("err", "Telefonul este obligatoriu.")
      return
    }
const pass = norm(uPassword)
    if (!editUser?.id && !pass) {
      showToast("err", "Parola este obligatorie la creare.")
      return
    }
    if (pass) body.password = pass

    setSaving(true)
    try {
      if (editUser?.id) {
        const id = Number(editUser.id)
        const updated = await apiFetch(`/users/${id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        })
        setAll((prev) => (prev || []).map((x) => (Number(x.id) === id ? (updated || { ...x, ...body }) : x)))
        showToast("ok", "Utilizator actualizat.")
      } else {
        const created = await apiFetch(`/users`, {
          method: "POST",
          body: JSON.stringify(body),
        })
        if (created) setAll((prev) => [created, ...(prev || [])])
        showToast("ok", "Utilizator creat.")
      }
      setShowEdit(false)
    } catch (e2) {
      showToast("err", e2?.message || "Operație utilizator eșuată (încă).")
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(u) {
    if (!u?.id) return
    if (saving) return

    const activeVal = u?.active
    const active = activeVal === undefined ? !yn(u?.disabled) : yn(activeVal)
    const nextActive = !active

    const ok = window.confirm(nextActive ? "Reactivezi acest utilizator?" : "Dezactivezi acest utilizator?")
    if (!ok) return

    setSaving(true)
    try {
      const id = Number(u.id)
      const updated = await apiFetch(`/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: nextActive }),
      })
      setAll((prev) => (prev || []).map((x) => (Number(x.id) === id ? (updated || { ...x, active: nextActive }) : x)))
      showToast("ok", nextActive ? "Utilizator reactivat." : "Utilizator dezactivat.")
    } catch (e) {
      showToast("err", e?.message || "Operație eșuată.")
    } finally {
      setSaving(false)
    }
  }

  async function removeUser(u) {
    if (!u?.id) return
    if (saving) return

    const ok = window.confirm("Ștergi definitiv acest utilizator? (nu recomand)")
    if (!ok) return

    setSaving(true)
    try {
      const id = Number(u.id)
      await apiFetch(`/users/${id}`, { method: "DELETE" })
      setAll((prev) => (prev || []).filter((x) => Number(x.id) !== id))
      showToast("ok", "Utilizator șters.")
    } catch (e) {
      showToast("err", e?.message || "Ștergere eșuată.")
    } finally {
      setSaving(false)
    }
  }

  const admin = true

  return (
    <div className="p-6">
      <Toast toast={toast} onClose={() => setToast(null)} />

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Utilizatori</h1>
            <div className="text-sm">
                <span className="font-medium text-yellow-400">
                Salut{user?.name ? `, ${user.name}` : ""}
                </span>
            </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            className="rounded-lg bg-white/10 px-3 py-2 hover:bg-white/15 text-white"
          >
            Reîncarcă
          </button>
          <button
            type="button"
            onClick={openCreate}
            disabled={!admin || loading}
            className={`rounded-lg px-3 py-2 text-black ${!admin || loading ? "bg-yellow-500/40 cursor-not-allowed" : "bg-yellow-400 hover:bg-yellow-300"}`}
          >
            + Utilizator
          </button>
        </div>
      </div>


      {admin ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between mb-4">
            <div className="flex-1">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Caută (nume, email, telefon, rol)…"
                className="w-full rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-white placeholder:text-white/40 outline-none focus:border-white/20"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-white outline-none"
              >
                <option value="ALL">Toți</option>
                <option value="ACTIVE">Activi</option>
                <option value="INACTIVE">Inactivi</option>
              </select>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-white outline-none"
              >
                <option value="ALL">Toate rolurile</option>
                {(rolesInData.length ? rolesInData : ["admin", "user"]).map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="py-10 text-center text-white/70">Se încarcă…</div>
          ) : err ? (
            <div className="py-10 text-center text-red-200">{err}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-white">
                <thead className="text-white/70">
                  <tr>
                    <th
                      className="text-center py-2 px-3 cursor-pointer select-none hover:text-white"
                      onClick={() => toggleSort("name")}
                    >
                      Nume{sortArrow("name")}
                    </th>
                    <th
                      className="text-center py-2 px-3 cursor-pointer select-none hover:text-white"
                      onClick={() => toggleSort("email")}
                    >
                      Email{sortArrow("email")}
                    </th>
                    <th
                      className="text-center py-2 px-3 cursor-pointer select-none hover:text-white"
                      onClick={() => toggleSort("phone")}
                    >
                      Telefon{sortArrow("phone")}
                    </th>
                    <th
                      className="text-center py-2 px-3 cursor-pointer select-none hover:text-white"
                      onClick={() => toggleSort("role")}
                    >
                      Rol{sortArrow("role")}
                    </th>
                    <th
                      className="text-center py-2 px-3 cursor-pointer select-none hover:text-white"
                      onClick={() => toggleSort("active")}
                    >
                      Status{sortArrow("active")}
                    </th>
                    <th className="text-center py-2 px-3">Acțiuni</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-white/60">
                        Niciun utilizator.
                      </td>
                    </tr>
                  ) : (
                    rows.map((u) => {
                      const id = Number(u?.id)
                      const name = u?.name ?? u?.full_name ?? u?.fullname ?? `User #${id}`
                      const email = u?.email ?? u?.username ?? "—"
                      const phone = u?.phone ?? u?.telefon ?? "—"
                      const role = u?.role ?? u?.user_role ?? u?.userRole ?? "—"
                      const activeVal = u?.active
                      const active = activeVal === undefined ? !yn(u?.disabled) : yn(activeVal)

                      return (
                        <tr key={String(u?.id)} className="border-t border-white/10">
                          <td className="py-2 px-3 text-center font-bold">{name}</td>
                          <td className="py-2 px-3 text-center">{email}</td>
                          <td className="py-2 px-3 text-center">{phone}</td>
                          <td className="py-2 px-3 text-center">{String(role)}</td>
                          <td className="py-2 px-3 text-center">
                            <span className={`inline-flex items-center rounded-lg px-2 py-1 text-xs border ${active ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-200" : "bg-white/5 border-white/10 text-white/70"}`}>
                              {active ? "activ" : "inactiv"}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => openEdit(u)}
                                className="rounded-lg bg-white/10 px-3 py-1.5 hover:bg-white/15"
                              >
                                Editează
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleActive(u)}
                                className={`rounded-lg px-3 py-1.5 ${active ? "bg-red-500/15 hover:bg-red-500/25 text-red-100" : "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-100"}`}
                              >
                                {active ? "Dezactivează" : "Reactivează"}
                              </button>
                              <button
                                type="button"
                                onClick={() => removeUser(u)}
                                className="rounded-lg bg-white/10 px-3 py-1.5 hover:bg-white/15 text-white/80"
                                title="Ștergere definitivă"
                              >
                                Șterge
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {showEdit ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#101826] p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-bold text-white">{editUser?.id ? "Editează utilizator" : "Utilizator nou"}</div>
              <button
                type="button"
                onClick={() => setShowEdit(false)}
                className="rounded-lg bg-white/10 hover:bg-white/15 px-2 py-1 text-white/80"
              >
                ✕
              </button>
            </div>

            <form onSubmit={saveUser} className="space-y-3">
              <div>
                <label className="block text-white/70 text-sm mb-1">Nume *</label>
                <input
                  value={uName}
                  onChange={(e) => setUName(e.target.value)}
                  className="w-full rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-white outline-none focus:border-white/20"
                />
              </div>


              <div>
                <label className="block text-white/70 text-sm mb-1">Telefon *</label>
                <input
                  value={uPhone}
                  onChange={(e) => setUPhone(e.target.value)}
                  className="w-full rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-white outline-none focus:border-white/20"
                />
              </div>

              <div>
                <label className="block text-white/70 text-sm mb-1">Email (opțional)</label>
                <input
                  value={uEmail}
                  onChange={(e) => setUEmail(e.target.value)}
                  className="w-full rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-white outline-none focus:border-white/20"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-white/70 text-sm mb-1">Rol</label>
                  <select
                    value={uRole}
                    onChange={(e) => setURole(e.target.value)}
                    className="w-full rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-white outline-none"
                  >
                    {(rolesInData.length ? rolesInData : ["admin", "user"]).map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-white/70 text-sm mb-1">Status</label>
                  <select
                    value={uActive ? "ACTIVE" : "INACTIVE"}
                    onChange={(e) => setUActive(e.target.value === "ACTIVE")}
                    className="w-full rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-white outline-none"
                  >
                    <option value="ACTIVE">activ</option>
                    <option value="INACTIVE">inactiv</option>
                  </select>
                </div>

                <div>
                  <label className="block text-white/70 text-sm mb-1">Parolă {editUser?.id ? "(reset, opțional)" : "*"}</label>
                  <input
                    value={uPassword}
                    onChange={(e) => setUPassword(e.target.value)}
                    type="password"
                    placeholder={editUser?.id ? "Lasă gol dacă nu schimbi" : "Parolă"}
                    className="w-full rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-white placeholder:text-white/40 outline-none focus:border-white/20"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEdit(false)}
                  className="rounded-lg bg-white/10 px-4 py-2 hover:bg-white/15 text-white"
                >
                  Anulează
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={`rounded-lg px-4 py-2 text-black ${saving ? "bg-yellow-500/40 cursor-not-allowed" : "bg-yellow-400 hover:bg-yellow-300"}`}
                >
                  {saving ? "Se salvează…" : "Salvează"}
                </button>
              </div>

              <div className="text-xs text-white/40 pt-1">
                * Dacă unele endpoint-uri nu există încă în backend, vei vedea un mesaj de eroare, dar pagina rămâne funcțională.
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
