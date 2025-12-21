import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { apiFetch } from "../auth/api"

function fmtRON(x) {
  const n = Number(x || 0)
  return `${n.toFixed(2)} RON`
}

function norm(v) {
  return String(v ?? "").trim()
}

function cmp(a, b) {
  if (a === b) return 0
  if (a == null) return -1
  if (b == null) return 1
  const as = typeof a === "string" ? a.toLowerCase() : a
  const bs = typeof b === "string" ? b.toLowerCase() : b
  return as > bs ? 1 : -1
}

export default function Stock() {
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  const [all, setAll] = useState([]) // raw from API
  const [q, setQ] = useState("")
  const [locFilter, setLocFilter] = useState("ALL") // ALL | ZOR | IRS
  const [sort, setSort] = useState({ key: "material_name", dir: "asc" }) // key, dir

  // banner
  const [toast, setToast] = useState(null) // {type, msg}

  async function load() {
    setLoading(true)
    setErr(null)
    try {
      const res = await apiFetch("/stock")
      const arr = Array.isArray(res) ? res : res?.value ?? []
      setAll(arr)
    } catch (e) {
      setErr(e?.message || "Nu pot încărca stocul.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- Normalize: merge duplicates by (material_id, location_id) just in case
  const rows = useMemo(() => {
    const m = new Map()
    for (const it of all || []) {
      const mid = Number(it.material_id)
      const lid = Number(it.location_id)
      const key = `${mid}-${lid}`
      const prev = m.get(key)
      const unitPrice = Number(it.unit_price ?? it.unitPrice ?? it.price ?? 0) || 0
      const qty = Number(it.qty ?? 0) || 0
      const next = prev
        ? {
            ...prev,
            qty: (Number(prev.qty) || 0) + qty,
          }
        : {
            material_id: mid,
            material_name: it.material_name ?? it.name ?? "-",
            unit: it.unit ?? "-",
            location_id: lid,
            location_code: it.location_code ?? "",
            location_name: it.location_name ?? it.location ?? "",
            unit_price: unitPrice,
            qty,
          }
      m.set(key, next)
    }
    // compute total_value
    return Array.from(m.values()).map((it) => ({
      ...it,
      total_value: (Number(it.qty) || 0) * (Number(it.unit_price) || 0),
    }))
  }, [all])

  const totalValueAll = useMemo(() => {
    return rows.reduce((s, it) => s + (Number(it.total_value) || 0), 0)
  }, [rows])

  const filtered = useMemo(() => {
    const qq = norm(q).toLowerCase()
    let arr = rows

    if (locFilter !== "ALL") {
      arr = arr.filter((x) => String(x.location_code || "").toUpperCase() === locFilter)
    }

    if (qq) {
      arr = arr.filter((x) => {
        const hay = `${x.material_name} ${x.location_name} ${x.location_code}`.toLowerCase()
        return hay.includes(qq)
      })
    }

    const { key, dir } = sort
    const mul = dir === "desc" ? -1 : 1

    arr = [...arr].sort((a, b) => {
      let va = a[key]
      let vb = b[key]
      // numbers
      if (key === "qty" || key === "unit_price" || key === "total_value") {
        va = Number(va || 0)
        vb = Number(vb || 0)
      }
      return cmp(va, vb) * mul
    })

    return arr
  }, [rows, q, locFilter, sort])

  // group view (Zorilor / Iris) for clarity
  const grouped = useMemo(() => {
    const by = (code) => filtered.filter((x) => String(x.location_code || "").toUpperCase() === code)
    return {
      ZOR: by("ZOR"),
      IRS: by("IRS"),
      OTHER: filtered.filter((x) => {
        const c = String(x.location_code || "").toUpperCase()
        return c !== "ZOR" && c !== "IRS"
      }),
    }
  }, [filtered])

  // ===== modal intrare stoc =====
  const [showIn, setShowIn] = useState(false)
  const [inLocCode, setInLocCode] = useState("ZOR")
  const [inQty, setInQty] = useState("")
  const [inNote, setInNote] = useState("")
  const [inUnitPrice, setInUnitPrice] = useState("") // optional override
  const [saving, setSaving] = useState(false)

  // material autocomplete
  const [matQ, setMatQ] = useState("")
  const [matOptions, setMatOptions] = useState([])
  const [matLoading, setMatLoading] = useState(false)
  const [selectedMat, setSelectedMat] = useState(null) // {id,name,unit,price,sku}
  const matDebounceRef = useRef(null)

  useEffect(() => {
    if (!showIn) return
    // reset
    setErr(null)
    setToast(null)
    setMatQ("")
    setSelectedMat(null)
    setMatOptions([])
    setInQty("")
    setInNote("")
    setInUnitPrice("")
    setInLocCode("ZOR")
  }, [showIn])

  useEffect(() => {
    if (!showIn) return
    const qq = norm(matQ)
    if (matDebounceRef.current) clearTimeout(matDebounceRef.current)
    matDebounceRef.current = setTimeout(async () => {
      if (!qq) {
        setMatOptions([])
        return
      }
      setMatLoading(true)
      try {
        const res = await apiFetch(`/materials?q=${encodeURIComponent(qq)}`)
        const arr = Array.isArray(res) ? res : res?.value ?? res?.items ?? []
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
  }, [matQ, showIn])

  async function submitIn(e) {
    e.preventDefault()
    setErr(null)
    setToast(null)

    if (!selectedMat?.id) {
      setErr("Selectează un material.")
      return
    }
    const qty = Number(inQty)
    if (!qty || qty <= 0) {
      setErr("Cantitatea trebuie să fie > 0.")
      return
    }

    const body = {
      material_id: Number(selectedMat.id),
      qty,
      location_code: String(inLocCode).toUpperCase(),
      note: norm(inNote) || null,
    }
    const up = Number(inUnitPrice)
    if (inUnitPrice && up > 0) body.unit_price = up

    setSaving(true)
    try {
      await apiFetch("/stock/in", {
        method: "POST",
        body: JSON.stringify(body),
      })
      setToast({ type: "ok", msg: "Stoc adăugat cu succes." })
      setShowIn(false)
      await load()
    } catch (e2) {
      setErr(e2?.message || "Intrarea în stoc a eșuat.")
    } finally {
      setSaving(false)
    }
  }

  function sortToggle(key) {
    setSort((prev) => {
      if (prev.key !== key) return { key, dir: "asc" }
      return { key, dir: prev.dir === "asc" ? "desc" : "asc" }
    })
  }

  function SortTh({ k, children, align = "text-center" }) {
    const active = sort.key === k
    const arrow = !active ? "" : sort.dir === "asc" ? " ▲" : " ▼"
    return (
      <th
        className={`${align} py-3 px-3 select-none cursor-pointer hover:text-white`}
        onClick={() => sortToggle(k)}
        title="Click pentru sortare"
      >
        {children}
        <span className="opacity-70">{arrow}</span>
      </th>
    )
  }

  function Table({ title, items }) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="font-semibold">{title}</div>
          <div className="text-sm opacity-70">
            {items.length} poziții • Valoare:{" "}
            <span className="font-semibold">{fmtRON(items.reduce((s, x) => s + (Number(x.total_value) || 0), 0))}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-white/70">
              <tr className="text-center">
                <SortTh k="material_name">Material</SortTh>
                <SortTh k="qty">Cantitate</SortTh>
                <SortTh k="unit">UM</SortTh>
                <SortTh k="unit_price">Preț unitar</SortTh>
                <SortTh k="total_value">Valoare</SortTh>
                <SortTh k="location_name">Locație</SortTh>
              </tr>
            </thead>

            <tbody>
              {items.map((it) => (
                <tr key={`${it.material_id}-${it.location_id}`} className="text-center border-t border-white/5">
                  <td className="py-3 px-3 font-semibold">{it.material_name}</td>
                  <td className="py-3 px-3">{Number(it.qty || 0).toFixed(2)}</td>
                  <td className="py-3 px-3 opacity-80">{it.unit}</td>
                  <td className="py-3 px-3">{fmtRON(it.unit_price)}</td>
                  <td className="py-3 px-3 font-semibold">{fmtRON(it.total_value)}</td>
                  <td className="py-3 px-3 opacity-80">{it.location_name || it.location_code}</td>
                </tr>
              ))}

              {items.length === 0 && (
                <tr>
                  <td className="py-8 px-3 text-center opacity-70" colSpan={6}>
                    Nu există rezultate.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      {/* header row */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--yellow)" }}>
            Stoc
          </h1>
          <div className="text-sm opacity-70 mt-1">Stoc pe locații (Zorilor / Iris)</div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link to="/materiale" className="rounded-xl bg-white/10 px-4 py-2 hover:bg-white/15">
            ← Materiale
          </Link>

          <button
            onClick={() => setShowIn(true)}
            className="rounded-xl px-4 py-2 font-semibold"
            style={{ background: "var(--yellow)", color: "#000" }}
          >
            + Intrare stoc
          </button>

          <button onClick={load} className="rounded-xl bg-white/10 px-4 py-2 hover:bg-white/15">
            Reîncarcă
          </button>
        </div>
      </div>

      {/* top bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            className="w-80 max-w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2 outline-none"
            placeholder="Caută material / locație…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <div className="flex gap-1">
            <button
              onClick={() => setLocFilter("ALL")}
              className={`rounded-lg px-3 py-2 ${locFilter === "ALL" ? "bg-white/15" : "bg-white/5 hover:bg-white/10"}`}
            >
              Toate
            </button>
            <button
              onClick={() => setLocFilter("ZOR")}
              className={`rounded-lg px-3 py-2 ${locFilter === "ZOR" ? "bg-white/15" : "bg-white/5 hover:bg-white/10"}`}
            >
              Zorilor
            </button>
            <button
              onClick={() => setLocFilter("IRS")}
              className={`rounded-lg px-3 py-2 ${locFilter === "IRS" ? "bg-white/15" : "bg-white/5 hover:bg-white/10"}`}
            >
              Iris
            </button>
          </div>
        </div>

        <div className="text-sm opacity-80">
          Valoare stoc: <span className="font-semibold">{fmtRON(totalValueAll)}</span>
        </div>
      </div>

      {toast?.type === "ok" && (
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-emerald-100">
          {toast.msg}
        </div>
      )}

      {err && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-200">
          {err}
        </div>
      )}

      {loading ? (
        <div className="opacity-70">Se încarcă…</div>
      ) : (
        <div className="space-y-4">
          <Table title="Zorilor (ZOR)" items={grouped.ZOR} />
          <Table title="Iris (IRS)" items={grouped.IRS} />
          {grouped.OTHER.length > 0 && <Table title="Alte locații" items={grouped.OTHER} />}
        </div>
      )}

      {/* ===== modal intrare stoc ===== */}
      {showIn && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.65)" }}>
          <div className="w-full max-w-lg rounded-2xl p-5 border border-white/10" style={{ background: "var(--panel)" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: "var(--yellow)" }}>
                Intrare stoc
              </h2>
              <button onClick={() => setShowIn(false)} className="px-2 py-1 rounded bg-black">
                ✕
              </button>
            </div>

            <form onSubmit={submitIn} className="space-y-3">
              {/* location */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setInLocCode("ZOR")}
                  className={`flex-1 px-3 py-2 rounded font-semibold ${inLocCode === "ZOR" ? "bg-yellow-400 text-black" : "bg-white/10"}`}
                >
                  Zorilor
                </button>
                <button
                  type="button"
                  onClick={() => setInLocCode("IRS")}
                  className={`flex-1 px-3 py-2 rounded font-semibold ${inLocCode === "IRS" ? "bg-yellow-400 text-black" : "bg-white/10"}`}
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
                  placeholder="Scrie numele materialului…"
                  value={matQ}
                  onChange={(e) => {
                    setMatQ(e.target.value)
                    setSelectedMat(null)
                  }}
                />
                {matLoading && <div className="text-xs opacity-70 mt-1">Caut…</div>}

                {matOptions?.length > 0 && (
                  <div className="mt-2 rounded border border-white/10 bg-black/40 max-h-56 overflow-auto">
                    {matOptions.map((m) => (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => {
                          setSelectedMat(m)
                          setMatQ(m.name)
                          setMatOptions([])
                          // default unit price to material price (optional)
                          if (!inUnitPrice && Number(m.price) > 0) setInUnitPrice(String(Number(m.price)))
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-white/10"
                      >
                        <div className="font-semibold">{m.name}</div>
                        <div className="text-xs opacity-70">
                          {m.sku ? `SKU: ${m.sku} • ` : ""}UM: {m.unit || "-"} • Preț: {fmtRON(m.price)}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {selectedMat && (
                  <div className="text-xs opacity-80 mt-1">
                    Selectat: <span className="font-semibold">{selectedMat.name}</span>
                    <span className="opacity-70"> • UM: {selectedMat.unit || "-"}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs" style={{ color: "var(--muted)" }}>
                    Cantitate *
                  </label>
                  <input
                    className="w-full px-3 py-2 rounded bg-black/20 outline-none"
                    inputMode="decimal"
                    value={inQty}
                    onChange={(e) => setInQty(e.target.value)}
                    placeholder="ex: 10"
                  />
                </div>

                <div>
                  <label className="text-xs" style={{ color: "var(--muted)" }}>
                    Preț unitar (opțional)
                  </label>
                  <input
                    className="w-full px-3 py-2 rounded bg-black/20 outline-none"
                    inputMode="decimal"
                    value={inUnitPrice}
                    onChange={(e) => setInUnitPrice(e.target.value)}
                    placeholder="ex: 12.5"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs" style={{ color: "var(--muted)" }}>
                  Notă (opțional)
                </label>
                <input
                  className="w-full px-3 py-2 rounded bg-black/20 outline-none"
                  value={inNote}
                  onChange={(e) => setInNote(e.target.value)}
                  placeholder="ex: factură / aprovizionare"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowIn(false)} className="flex-1 px-3 py-2 rounded bg-black">
                  Anulează
                </button>
                <button
                  disabled={saving}
                  type="submit"
                  className="flex-1 px-3 py-2 rounded font-semibold"
                  style={{ background: "var(--yellow)", color: "#000" }}
                >
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
