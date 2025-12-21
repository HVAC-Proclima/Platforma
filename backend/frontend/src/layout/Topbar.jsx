import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { apiFetch } from "../auth/api"

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
      if (Array.isArray(arr)) return { path: p, data: arr }
    } catch {
      // try next
    }
  }
  return { path: null, data: [] }
}

export default function Topbar({ user, onLogout }) {
  const navigate = useNavigate()

  const [q, setQ] = useState("")
  const qq = normalize(q)

  const [open, setOpen] = useState(false)
  const closeTimer = useRef(null)

  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)

  const [clients, setClients] = useState([])
  const [materials, setMaterials] = useState([])
  const [stock, setStock] = useState([])
  const [projects, setProjects] = useState([])

  // Încarcă dataset-urile o singură dată (la primul focus / prima tastare)
  async function ensureLoaded() {
    if (loaded || loading) return
    setLoading(true)
    try {
      const [cRes, mRes, sRes] = await Promise.allSettled([
        apiFetch("/clients"),
        apiFetch("/materials"),
        apiFetch("/stock"),
      ])

      setClients(cRes.status === "fulfilled" ? coerceArray(cRes.value) : [])
      setMaterials(mRes.status === "fulfilled" ? coerceArray(mRes.value) : [])
      setStock(sRes.status === "fulfilled" ? coerceArray(sRes.value) : [])

      // lucrări / proiecte (încercăm câteva rute uzuale; dacă nu există, rămâne gol)
      const p = await tryFetchFirst(["/projects", "/lucrari", "/works", "/jobs"])
      setProjects(p.data || [])
      setLoaded(true)
    } finally {
      setLoading(false)
    }
  }

  // Debounce mic: nu recalculăm aggressive
  const suggestions = useMemo(() => {
    const out = { clients: [], materials: [], stock: [], projects: [] }
    if (!qq || qq.length < 2) return out

    // clienți: nume + telefon + email + adresă + CUI/CNP
    const cl = (clients || []).filter((c) => {
      const hay = normalize(
        `${c?.name ?? ""} ${c?.phone ?? ""} ${c?.email ?? ""} ${c?.address ?? ""} ${c?.cui ?? ""} ${c?.cnp ?? ""} ${c?.vat ?? ""}`
      )
      return hay.includes(qq)
    })

    // materiale: nume + sku + categorie + unitate
    const ma = (materials || []).filter((m) => {
      const hay = normalize(`${m?.name ?? ""} ${m?.sku ?? ""} ${m?.category ?? ""} ${m?.unit ?? ""}`)
      return hay.includes(qq)
    })

    // stoc: material + categorie + locație + sku
    const st = (stock || []).filter((r) => {
      const hay = normalize(
        `${r?.material_name ?? ""} ${r?.sku ?? ""} ${r?.category ?? ""} ${r?.location_name ?? ""} ${r?.location_code ?? ""}`
      )
      return hay.includes(qq)
    })

    // lucrări/proiecte: nume/titlu + client + CUI/CNP (dacă backend le include)
    const pr = (projects || []).filter((p) => {
      const hay = normalize(
        `${p?.name ?? ""} ${p?.title ?? ""} ${p?.code ?? ""} ${p?.status ?? ""} ${p?.client_name ?? ""} ${p?.clientName ?? ""} ${p?.cui ?? ""} ${p?.cnp ?? ""}`
      )
      return hay.includes(qq)
    })

    out.clients = cl.slice(0, 6)
    out.materials = ma.slice(0, 6)
    out.stock = st.slice(0, 6)
    out.projects = pr.slice(0, 6)

    return out
  }, [qq, clients, materials, stock, projects])

  const total =
    suggestions.clients.length +
    suggestions.materials.length +
    suggestions.stock.length +
    suggestions.projects.length

  function goSearch() {
    const t = (q || "").trim()
    if (!t) return
    setOpen(false)
    navigate(`/search?q=${encodeURIComponent(t)}`)
  }

  function onFocus() {
    ensureLoaded()
    if (qq.length >= 2) setOpen(true)
  }

  function onBlur() {
    // închidem cu un mic delay ca să permitem click pe rezultate
    window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => setOpen(false), 150)
  }

  function onInputChange(v) {
    setQ(v)
    if (v.trim().length >= 2) {
      ensureLoaded()
      setOpen(true)
    } else {
      setOpen(false)
    }
  }

  return (
    <header
      className="h-14 flex items-center px-4 border-b gap-4"
      style={{ background: "var(--panel)", borderColor: "var(--border)" }}
    >
      {/* Stânga */}
      <div className="hidden md:block text-sm" style={{ color: "var(--muted)" }}>
        Platformă de management
      </div>

      {/* Search global + autocomplete */}
      <div className="relative flex-1 max-w-3xl">
        <input
          value={q}
          onChange={(e) => onInputChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={(e) => {
            if (e.key === "Enter") goSearch()
            if (e.key === "Escape") setOpen(false)
          }}
          placeholder="Căutare globală (clienți, CUI/CNP, materiale, stoc, lucrări)…"
          className="w-full rounded-lg bg-black/20 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
        />

        {open && (qq.length >= 2) ? (
          <div className="absolute left-0 right-0 mt-2 rounded-xl border border-white/10 bg-[#0f1724] shadow-lg overflow-hidden z-50">
            <div className="px-3 py-2 text-xs text-white/50 flex items-center justify-between border-b border-white/10">
              <span>
                {loading ? "Se încarcă…" : total ? `Rezultate: ${total}` : "Niciun rezultat"}
              </span>
              <button
                type="button"
                className="text-white/60 hover:text-white/80"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setOpen(false)}
                title="Închide"
              >
                ✕
              </button>
            </div>

            {!loading && total === 0 ? (
              <div className="px-3 py-3 text-sm text-white/70">
                Nu am găsit nimic pentru „{q}”.
              </div>
            ) : null}

            {suggestions.projects.length ? (
              <>
                <div className="px-3 pt-3 pb-1 text-xs text-white/50 uppercase">Lucrări</div>
                {suggestions.projects.map((p, i) => {
                  const clientId = p?.client_id ?? p?.clientId
                  const projectId = p?.id ?? p?.project_id ?? p?.projectId
                  const to = clientId && projectId ? `/clienti/${clientId}/lucrari/${projectId}` : "/clienti"
                  const label = p?.name ?? p?.title ?? `Lucrare #${projectId ?? i + 1}`
                  const sub = p?.client_name ?? p?.clientName ?? ""
                  return (
                    <Link
                      key={String(projectId ?? label) + "-" + i}
                      to={to}
                      className="block px-3 py-2 hover:bg-white/10 text-sm text-white/80"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setOpen(false)}
                    >
                      <div className="font-medium text-white/90">{label}</div>
                      {sub ? <div className="text-xs text-white/50">Client: {sub}</div> : null}
                    </Link>
                  )
                })}
              </>
            ) : null}

            {suggestions.clients.length ? (
              <>
                <div className="px-3 pt-3 pb-1 text-xs text-white/50 uppercase">Clienți</div>
                {suggestions.clients.map((c) => (
                  <Link
                    key={String(c?.id)}
                    to={`/clienti/${c?.id}`}
                    className="block px-3 py-2 hover:bg-white/10 text-sm text-white/80"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setOpen(false)}
                  >
                    <div className="font-medium text-white/90">{c?.name || `Client #${c?.id}`}</div>
                    <div className="text-xs text-white/50">
                      {(c?.phone ? `Tel: ${c.phone}` : "")}
                      {c?.cui ? ` • CUI: ${c.cui}` : ""}
                      {c?.cnp ? ` • CNP: ${c.cnp}` : ""}
                    </div>
                  </Link>
                ))}
              </>
            ) : null}

            {suggestions.materials.length ? (
              <>
                <div className="px-3 pt-3 pb-1 text-xs text-white/50 uppercase">Materiale</div>
                {suggestions.materials.map((m) => (
                  <Link
                    key={String(m?.id)}
                    to="/materiale"
                    className="block px-3 py-2 hover:bg-white/10 text-sm text-white/80"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setOpen(false)}
                  >
                    <div className="font-medium text-white/90">{m?.name || `Material #${m?.id}`}</div>
                    <div className="text-xs text-white/50">
                      {m?.category ? `Cat: ${m.category} • ` : ""}UM: {m?.unit || "—"}{m?.sku ? ` • SKU: ${m.sku}` : ""}
                    </div>
                  </Link>
                ))}
              </>
            ) : null}

            {suggestions.stock.length ? (
              <>
                <div className="px-3 pt-3 pb-1 text-xs text-white/50 uppercase">Stoc</div>
                {suggestions.stock.map((r, i) => (
                  <Link
                    key={`${r?.material_id ?? r?.material_name ?? "row"}-${r?.location_id ?? r?.location_name ?? "loc"}-${i}`}
                    to="/stoc"
                    className="block px-3 py-2 hover:bg-white/10 text-sm text-white/80"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setOpen(false)}
                  >
                    <div className="font-medium text-white/90">{r?.material_name || "—"}</div>
                    <div className="text-xs text-white/50">
                      {r?.category ? `Cat: ${r.category} • ` : ""}
                      Locație: {r?.location_name || "—"}{r?.location_code ? ` (${r.location_code})` : ""}
                    </div>
                  </Link>
                ))}
              </>
            ) : null}

            <div className="px-3 py-2 border-t border-white/10 text-xs text-white/50">
              Enter → caută toate rezultatele • Esc → închide
            </div>
          </div>
        ) : null}
      </div>

      {/* Dreapta */}
      <div className="ml-auto flex items-center gap-4 text-sm">
        <span className="font-medium text-yellow-400 hidden sm:inline">
          Salut{user?.name ? `, ${user.name}` : ""}
        </span>

        <button
          onClick={onLogout}
          title="Delogare"
          className="
            group flex items-center gap-2
            rounded-lg px-3 py-1.5
            bg-white/10 hover:bg-white/20
            text-white/80 hover:text-white
            transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-yellow-400/40
          "
        >
          <span
            className="
              text-base leading-none
              opacity-80
              group-hover:opacity-100
              group-hover:translate-x-0.5
              transition-all duration-200
            "
            aria-hidden="true"
          >
            ⎋
          </span>
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  )
}
