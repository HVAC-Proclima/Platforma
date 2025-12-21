import React, { useEffect, useMemo, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { apiFetch } from "../auth/api"

function useQueryParam(name) {
  const { search } = useLocation()
  return useMemo(() => {
    const sp = new URLSearchParams(search)
    return sp.get(name) || ""
  }, [search, name])
}

function normalize(x) {
  return String(x ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
}

function coerceArray(res) {
  return Array.isArray(res) ? res : (res?.value || [])
}

async function tryFetchFirst(paths) {
  for (const p of paths) {
    try {
      const r = await apiFetch(p)
      const arr = coerceArray(r)
      if (Array.isArray(arr)) return arr
    } catch {
      // next
    }
  }
  return []
}

function GroupTitle({ children }) {
  return (
    <div className="text-sm font-semibold text-white/80 mb-2 mt-6">
      {children}
    </div>
  )
}

export default function Search() {
  const q = useQueryParam("q")
  const qq = normalize(q)

  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  const [clients, setClients] = useState([])
  const [materials, setMaterials] = useState([])
  const [stock, setStock] = useState([])
  const [projects, setProjects] = useState([])

  useEffect(() => {
    let alive = true

    async function loadAll() {
      if (!qq) {
        setClients([])
        setMaterials([])
        setStock([])
        setProjects([])
        return
      }

      setLoading(true)
      setErr(null)

      try {
        const [cRes, mRes, sRes] = await Promise.all([
          apiFetch("/clients"),
          apiFetch("/materials"),
          apiFetch("/stock"),
        ])

        const pRes = await tryFetchFirst(["/projects", "/lucrari", "/works", "/jobs"])

        if (!alive) return

        setClients(coerceArray(cRes))
        setMaterials(coerceArray(mRes))
        setStock(coerceArray(sRes))
        setProjects(pRes)
      } catch (e) {
        if (!alive) return
        setErr(e?.message || "Eroare la căutare.")
      } finally {
        if (alive) setLoading(false)
      }
    }

    loadAll()
    return () => {
      alive = false
    }
  }, [qq])

  const results = useMemo(() => {
    if (!qq) return { clients: [], materials: [], stock: [], projects: [] }

    return {
      clients: clients.filter((c) =>
        normalize(
          `${c?.name ?? ""} ${c?.phone ?? ""} ${c?.email ?? ""} ${c?.address ?? ""} ${c?.cui ?? ""} ${c?.cnp ?? ""} ${c?.vat ?? ""}`
        ).includes(qq)
      ),
      materials: materials.filter((m) =>
        normalize(`${m?.name ?? ""} ${m?.sku ?? ""} ${m?.unit ?? ""} ${m?.category ?? ""}`).includes(qq)
      ),
      stock: stock.filter((r) =>
        normalize(
          `${r?.material_name ?? ""} ${r?.sku ?? ""} ${r?.unit ?? ""} ${r?.category ?? ""} ${r?.location_name ?? ""} ${r?.location_code ?? ""}`
        ).includes(qq)
      ),
      projects: projects.filter((p) =>
        normalize(
          `${p?.name ?? ""} ${p?.title ?? ""} ${p?.code ?? ""} ${p?.status ?? ""} ${p?.client_name ?? ""} ${p?.clientName ?? ""} ${p?.cui ?? ""} ${p?.cnp ?? ""}`
        ).includes(qq)
      ),
    }
  }, [qq, clients, materials, stock, projects])

  const total =
    results.clients.length +
    results.materials.length +
    results.stock.length +
    results.projects.length

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-1">Căutare</h1>
      <div className="text-sm text-white/60 mb-4">
        Interogare: <span className="text-white/80">{q || "—"}</span> • Rezultate:{" "}
        <span className="text-white/80">{total}</span>
      </div>

      {err && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-4 text-red-200">
          {err}
        </div>
      )}

      {loading && (
        <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-white/70">
          Se caută…
        </div>
      )}

      {!loading && total === 0 && q && (
        <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-white/70">
          Niciun rezultat.
        </div>
      )}

      {!q && (
        <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-white/70">
          Introdu un termen în câmpul de căutare.
        </div>
      )}

      {results.projects.length > 0 && (
        <>
          <GroupTitle>Lucrări</GroupTitle>
          {results.projects.map((p, i) => {
            const clientId = p?.client_id ?? p?.clientId
            const projectId = p?.id ?? p?.project_id ?? p?.projectId
            const to = clientId && projectId ? `/clienti/${clientId}/lucrari/${projectId}` : "/clienti"
            const label = p?.name ?? p?.title ?? `Lucrare #${projectId ?? i + 1}`
            const sub = p?.client_name ?? p?.clientName ?? ""
            return (
              <Link
                key={String(projectId ?? label) + "-" + i}
                to={to}
                className="block rounded-lg bg-white/5 hover:bg-white/10 px-4 py-3 mb-2"
              >
                <div className="font-semibold text-white">{label}</div>
                {sub ? <div className="text-sm text-white/60">Client: {sub}</div> : null}
              </Link>
            )
          })}
        </>
      )}

      {results.clients.length > 0 && (
        <>
          <GroupTitle>Clienți</GroupTitle>
          {results.clients.map((c) => (
            <Link
              key={String(c?.id)}
              to={`/clienti/${c?.id}`}
              className="block rounded-lg bg-white/5 hover:bg-white/10 px-4 py-3 mb-2"
            >
              <div className="font-semibold text-white">{c?.name || `Client #${c?.id}`}</div>
              <div className="text-sm text-white/60">
                {c?.phone ? `Tel: ${c.phone}` : ""}
                {c?.cui ? ` • CUI: ${c.cui}` : ""}
                {c?.cnp ? ` • CNP: ${c.cnp}` : ""}
                {c?.email ? ` • ${c.email}` : ""}
              </div>
            </Link>
          ))}
        </>
      )}

      {results.materials.length > 0 && (
        <>
          <GroupTitle>Materiale</GroupTitle>
          {results.materials.map((m) => (
            <Link
              key={String(m?.id)}
              to="/materiale"
              className="block rounded-lg bg-white/5 hover:bg-white/10 px-4 py-3 mb-2"
            >
              <div className="font-semibold text-white">{m?.name || `Material #${m?.id}`}</div>
              <div className="text-sm text-white/60">
                {m?.category ? `Cat: ${m.category} • ` : ""}UM: {m?.unit || "—"}{m?.sku ? ` • SKU: ${m.sku}` : ""}
              </div>
            </Link>
          ))}
        </>
      )}

      {results.stock.length > 0 && (
        <>
          <GroupTitle>Stoc</GroupTitle>
          {results.stock.map((r, i) => (
            <Link
              key={`${r?.material_id ?? r?.material_name ?? "row"}-${r?.location_id ?? r?.location_name ?? "loc"}-${i}`}
              to="/stoc"
              className="block rounded-lg bg-white/5 hover:bg-white/10 px-4 py-3 mb-2"
            >
              <div className="font-semibold text-white">{r?.material_name || "—"}</div>
              <div className="text-sm text-white/60">
                {r?.category ? `Cat: ${r.category} • ` : ""}
                Locație: {r?.location_name || "—"}{r?.location_code ? ` (${r.location_code})` : ""}
              </div>
            </Link>
          ))}
        </>
      )}
    </div>
  )
}
