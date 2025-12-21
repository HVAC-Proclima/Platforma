import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { apiFetch } from "../auth/api"

function money(x) {
  const n = Number(x || 0)
  return `${n.toFixed(2)} RON`
}

function norm(v) {
  return String(v ?? "").trim()
}

export default function Stock() {
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  const [all, setAll] = useState([]) // rows from /stock
  const [locFilter, setLocFilter] = useState("ZOR") // ALL | ZOR | IRS
  const [q, setQ] = useState("")

  // toast/banner
  const [toast, setToast] = useState(null) // {type, msg}
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  async function load() {
    setLoading(true)
    setErr(null)
    try {
      const res = await apiFetch("/stock")
      const arr = Array.isArray(res) ? res : (res?.value ?? [])
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

  // ===== modal: corecție stoc (setare absolută) =====
  const [showAdjust, setShowAdjust] = useState(false)
  const [adjustRow, setAdjustRow] = useState(null)
  const [adjustQty, setAdjustQty] = useState("")
  const [adjustNote, setAdjustNote] = useState("")
  const [adjustSaving, setAdjustSaving] = useState(false)

  function openAdjust(row) {
    setAdjustRow(row)
    setAdjustQty(String(row?.qty ?? ""))
    setAdjustNote("")
    setShowAdjust(true)
  }

  async function submitAdjust(e) {
    e.preventDefault()
    if (!adjustRow) return
    const qty = Number(adjustQty)
    if (!Number.isFinite(qty) || qty < 0) {
      setToast({ type: "error", msg: "Cantitatea trebuie să fie >= 0." })
      return
    }

    setAdjustSaving(true)
    setErr(null)
    try {
      // backend endpoint: POST /stock/adjust {material_id, location_id, qty, note?}
      await apiFetch("/stock/adjust", {
        method: "POST",
        body: JSON.stringify({
          material_id: Number(adjustRow.material_id),
          location_id: Number(adjustRow.location_id),
          qty,
          note: norm(adjustNote) || null,
        }),
      })
      setToast({ type: "ok", msg: "Stoc actualizat." })
      setShowAdjust(false)
      setAdjustRow(null)
      await load()
    } catch (e2) {
      setErr(e2?.message || "Corecția a eșuat.")
    } finally {
      setAdjustSaving(false)
    }
  }

  async function removeRow(row) {
    if (!row) return
    const ok = window.confirm(
      `Sigur vrei să ștergi stocul pentru:\n${row.material_name} @ ${row.location_name}?\n\n(va seta cantitatea la 0)`
    )
    if (!ok) return

    setErr(null)
    try {
      await apiFetch("/stock/adjust", {
        method: "POST",
        body: JSON.stringify({
          material_id: Number(row.material_id),
          location_id: Number(row.location_id),
          qty: 0,
          note: "remove (set 0)",
        }),
      })
      setToast({ type: "ok", msg: "Stoc șters (setat la 0)." })
      await load()
    } catch (e) {
      setErr(e?.message || "Remove a eșuat.")
    }
  }

  // ===== modal: intrare stoc (din material existent) =====
  const [showIn, setShowIn] = useState(false)
  const [inLocCode, setInLocCode] = useState("ZOR")
  const [inQty, setInQty] = useState("")
  const [inPrice, setInPrice] = useState("")
  const [inNote, setInNote] = useState("")
  const [inSaving, setInSaving] = useState(false)

  // material search
  const [inMatQ, setInMatQ] = useState("")
  const [inMatOptions, setInMatOptions] = useState([])
  const [inMatLoading, setInMatLoading] = useState(false)
  const [inSelectedMat, setInSelectedMat] = useState(null)
  const inDebounceRef = useRef(null)

  useEffect(() => {
    if (!showIn) return
    setInMatQ("")
    setInMatOptions([])
    setInSelectedMat(null)
    setInQty("")
    setInPrice("")
    setInNote("")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showIn])

  useEffect(() => {
    if (!showIn) return
    const qq = norm(inMatQ)
    if (inDebounceRef.current) clearTimeout(inDebounceRef.current)

    inDebounceRef.current = setTimeout(async () => {
      if (!qq) {
        setInMatOptions([])
        return
      }
      setInMatLoading(true)
      try {
        const res = await apiFetch(`/materials?q=${encodeURIComponent(qq)}`)
        const arr = Array.isArray(res) ? res : (res?.value ?? res?.items ?? [])
        setInMatOptions(arr.slice(0, 12))
      } catch {
        setInMatOptions([])
      } finally {
        setInMatLoading(false)
      }
    }, 200)

    return () => {
      if (inDebounceRef.current) clearTimeout(inDebounceRef.current)
    }
  }, [inMatQ, showIn])

  const locCodeToName = useMemo(() => ({ ZOR: "Zorilor", IRS: "Iris" }), [])

  async function submitIn(e) {
    e.preventDefault()
    if (!inSelectedMat?.id) {
      setToast({ type: "error", msg: "Selectează un material." })
      return
    }
    const qty = Number(inQty)
    if (!Number.isFinite(qty) || qty <= 0) {
      setToast({ type: "error", msg: "Cantitatea trebuie să fie > 0." })
      return
    }
    const price = inPrice ? Number(inPrice) : null
    if (inPrice && (!Number.isFinite(price) || price < 0)) {
      setToast({ type: "error", msg: "Preț invalid." })
      return
    }

    setInSaving(true)
    setErr(null)
    try {
      // backend endpoint: POST /stock/in {material_id, location_code, qty, price?, note?}
      await apiFetch("/stock/in", {
        method: "POST",
        body: JSON.stringify({
          material_id: Number(inSelectedMat.id),
          location_code: inLocCode,
          qty,
          price: price && price > 0 ? price : undefined,
          note: norm(inNote) || null,
        }),
      })
      setToast({ type: "ok", msg: `Intrare stoc: ${locCodeToName[inLocCode] || inLocCode}` })
      setShowIn(false)
      await load()
    } catch (e2) {
      setErr(e2?.message || "Intrarea de stoc a eșuat.")
    } finally {
      setInSaving(false)
    }
  }
 
  // =================== sort handlers ===================
  const toggleSort = (key) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"))
        return prev
      }
      setSortDir("asc")
      return key
    })
  }

  const sortArrow = (key) => {
    if (sortKey !== key) return ""
    return sortDir === "asc" ? " ▲" : " ▼"
  }

  // -----------------

  // =================== helpers ===================
  const normalizeText = (s) =>
    String(s ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()

  const toNumber = (v) => {
    if (v == null || v === "") return Number.NEGATIVE_INFINITY

    const s = String(v)
      .trim()
      .replace(/\s+/g, "")      // "1 234,56"
      .replace(/\./g, "")       // "1.234,56" -> "1234,56"
      .replace(",", ".")        // "1234,56" -> "1234.56"
      .replace(/[^\d.-]/g, "")  // scoate lei/RON/etc

    const n = Number(s)
    return Number.isFinite(n) ? n : Number.NEGATIVE_INFINITY
  }

  // =================== sorting state ===================
  const [sortKey, setSortKey] = useState("material_name")
  const [sortDir, setSortDir] = useState("asc") // "asc" | "desc"

  // =================== filtered + sorted ===================
  const filtered = useMemo(() => {
    const qq = normalizeText(q)
    const rows = Array.isArray(all) ? all : []

    return rows
      .filter((r) => {
        const okLoc =
          locFilter === "ALL"
            ? true
            : String(r.location_code ?? "").toUpperCase() === String(locFilter ?? "").toUpperCase()

        if (!okLoc) return false
        if (!qq) return true

        const hay = normalizeText(
          `${r.material_name ?? ""} ${r.location_name ?? ""} ${r.location_code ?? ""} ${r.sku ?? ""}`
        )

        return hay.includes(qq)
      })
      .sort((a, b) => {
        const dir = sortDir === "desc" ? -1 : 1
        const key = sortKey || "material_name"

        // numeric columns
        if (["qty", "unit_price", "total_value"].includes(key)) {
          const av = toNumber(a?.[key])
          const bv = toNumber(b?.[key])
          if (av !== bv) return (av - bv) * dir
          return String(a?.material_name ?? "").localeCompare(
            String(b?.material_name ?? ""),
            "ro"
          ) * dir
        }

        // string columns
        const av = String(a?.[key] ?? "")
        const bv = String(b?.[key] ?? "")
        const c = av.localeCompare(bv, "ro")
        if (c !== 0) return c * dir

        return String(a?.material_name ?? "").localeCompare(
          String(b?.material_name ?? ""),
          "ro"
        ) * dir
      })
  }, [all, locFilter, q, sortKey, sortDir])

  // =================== total value ===================
  const totalValue = useMemo(
    () => filtered.reduce((acc, r) => acc + toNumber(r.total_value), 0),
    [filtered]
  )

  // -----------------

  if (loading) return <div className="p-6 opacity-70">Se încarcă…</div>

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold" style={{ color: "var(--yellow)" }}>Stoc</h1>

        <div className="flex items-center gap-2 flex-wrap">
          <Link to="/materiale" className="rounded-xl bg-white/10 px-4 py-2 hover:bg-white/15">
            ← Materiale 
          </Link>

          <button
            className="rounded-xl px-4 py-2 font-semibold"
            style={{ background: "var(--yellow)", color: "#000" }}
            onClick={() => setShowIn(true)}
          >
            + Intrare stoc
          </button>

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
            + Intrare stoc
          </span>
        </button>

          <button className="rounded-xl bg-white/10 px-4 py-2 hover:bg-white/15" onClick={load}>
            Reîncarcă
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            className="px-3 py-2 rounded bg-black/20 outline-none min-w-[280px]"
            placeholder="Caută material / locație…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 outline-none"
            value={locFilter}
            onChange={(e) => setLocFilter(e.target.value)}
          >
            <option value="ALL">Toate locațiile</option>
            <option value="ZOR">Zorilor</option>
            <option value="IRS">Iris</option>
          </select>
        </div>

        <div className="text-md opacity-80">
          Valoare stoc: <span className="font-bold">{money(totalValue)}</span>
        </div>
      </div>

      {toast && (
        <div
          className="rounded-xl px-3 py-2 text-sm border"
          style={{
            background: toast.type === "ok" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
            borderColor: toast.type === "ok" ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)",
          }}
        >
          {toast.msg}
        </div>
      )}

      {err && (
        <div className="rounded-xl px-3 py-2 text-sm border border-red-500/25 bg-red-500/10 text-red-200">
          Eroare: {err}
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-white/70">
              <tr>
                <th 
                  className="text-center py-2 px-3 cursor-pointer select-none hover:text-white"
                  onClick={() => toggleSort("material_name")}
                  title="Sortează după nume"
                >
                  Material{sortArrow("material_name")}
                </th>
                <th 
                  className="text-center py-2 px-3 cursor-pointer select-none hover:text-white"
                  onClick={() => toggleSort("qty")}
                  title="Sortează după cantitate"
                >
                  Cantitate{sortArrow("qty")}
                </th>
                <th 
                  className="text-center py-2 px-3 cursor-pointer select-none hover:text-white"
                  onClick={() => toggleSort("unit")}
                  title="Sortează după unitate"
                >
                  Unitate{sortArrow("unit")}
                </th>
                <th 
                  className="text-center py-2 px-3 cursor-pointer select-none hover:text-white"
                  onClick={() => toggleSort("unit_price")}
                  title="Sortează după pret"
                >
                  Preț unitar{sortArrow("unit_price")}
                </th>
                <th 
                  className="text-center py-2 px-3 cursor-pointer select-none hover:text-white"
                  onClick={() => toggleSort("total_value")}
                  title="Sortează după valoare"
                >
                  Valoare{sortArrow("total_value")}
                </th>
                <th className="py-3 px-3 text-center">Locație</th>
                <th className="py-3 px-3 text-center">Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, idx) => (
                <tr key={`${r.material_id}-${r.location_id}-${idx}`} className="border-t border-white/5">
                  <td className="py-3 px-3 text-center font-semibold">{r.material_name}</td>
                  <td className="py-3 px-3 text-center">{Number(r.qty || 0).toFixed(2)}</td>
                  <td className="py-3 px-3 text-center">{r.unit || "-"}</td>
                  <td className="py-3 px-3 text-center">{money(r.unit_price)}</td>
                  <td className="py-3 px-3 text-center font-semibold">{money(r.total_value)}</td>
                  <td className="py-3 px-3 text-center">{r.location_name || r.location_code}</td>
                  <td className="py-3 px-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        className="rounded-lg bg-white/10 px-3 py-2 hover:bg-white/15"
                        onClick={() => openAdjust(r)}
                      >
                        Editează
                      </button>
                      <button
                        className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 hover:bg-red-500/15 text-red-200"
                        onClick={() => removeRow(r)}
                      >
                        Șterge
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center opacity-70">
                    Nu există poziții.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== Modal: Corectează ===== */}
      {showAdjust && adjustRow && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.65)" }}>
          <div className="w-full max-w-lg rounded-2xl p-5 border border-white/10" style={{ background: "var(--panel)" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: "var(--yellow)" }}>
                Corecție stoc (cantitate absolută)
              </h2>
              <button onClick={() => setShowAdjust(false)} className="px-2 py-1 rounded bg-black">
                ✕
              </button>
            </div>

            <div className="text-sm opacity-80 mb-3">
              <div><span className="opacity-60">Material:</span> <span className="font-semibold">{adjustRow.material_name}</span></div>
              <div><span className="opacity-60">Locație:</span> {adjustRow.location_name}</div>
            </div>

            <form onSubmit={submitAdjust} className="space-y-3">
              <div>
                <label className="text-xs" style={{ color: "var(--muted)" }}>
                  Cantitate (setează exact)
                </label>
                <input
                  className="w-full px-3 py-2 rounded bg-black/20 outline-none"
                  inputMode="decimal"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  placeholder="ex: 48"
                />
              </div>

              <div>
                <label className="text-xs" style={{ color: "var(--muted)" }}>
                  Notă (opțional)
                </label>
                <input
                  className="w-full px-3 py-2 rounded bg-black/20 outline-none"
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  placeholder="ex: inventar"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowAdjust(false)} className="flex-1 px-3 py-2 rounded bg-black">
                  Anulează
                </button>
                <button
                  disabled={adjustSaving}
                  type="submit"
                  className="flex-1 px-3 py-2 rounded font-semibold"
                  style={{ background: "var(--yellow)", color: "#000" }}
                >
                  {adjustSaving ? "Salvez..." : "Salvează"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== Modal: Intrare stoc ===== */}
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

              <div>
                <label className="text-xs" style={{ color: "var(--muted)" }}>Material</label>
                <input
                  className="w-full px-3 py-2 rounded bg-black/20 outline-none"
                  placeholder="Scrie numele materialului…"
                  value={inMatQ}
                  onChange={(e) => {
                    setInMatQ(e.target.value)
                    setInSelectedMat(null)
                  }}
                />
                {inMatLoading && <div className="text-xs opacity-70 mt-1">Caut…</div>}

                {(inMatOptions?.length > 0) && (
                  <div className="mt-2 rounded border border-white/10 bg-black/40 max-h-56 overflow-auto">
                    {inMatOptions.map((m) => (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => {
                          setInSelectedMat(m)
                          setInMatQ(m.name)
                          setInMatOptions([])
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-white/10"
                      >
                        <div className="font-semibold">{m.name}</div>
                        <div className="text-xs opacity-70">
                          {m.sku ? `SKU: ${m.sku} • ` : ""}UM: {m.unit || "-"} • Preț listă: {money(m.price)}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {inSelectedMat && (
                  <div className="text-xs opacity-80 mt-1">
                    Selectat: <span className="font-semibold">{inSelectedMat.name}</span> (UM: {inSelectedMat.unit || "—"})
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs" style={{ color: "var(--muted)" }}>Cantitate</label>
                  <input
                    className="w-full px-3 py-2 rounded bg-black/20 outline-none"
                    inputMode="decimal"
                    value={inQty}
                    onChange={(e) => setInQty(e.target.value)}
                    placeholder="ex: 10"
                  />
                </div>
                <div>
                  <label className="text-xs" style={{ color: "var(--muted)" }}>Preț unitar (opțional)</label>
                  <input
                    className="w-full px-3 py-2 rounded bg-black/20 outline-none"
                    inputMode="decimal"
                    value={inPrice}
                    onChange={(e) => setInPrice(e.target.value)}
                    placeholder="gol = păstrează"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs" style={{ color: "var(--muted)" }}>Notă (opțional)</label>
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
                  disabled={inSaving}
                  type="submit"
                  className="flex-1 px-3 py-2 rounded font-semibold"
                  style={{ background: "var(--yellow)", color: "#000" }}
                >
                  {inSaving ? "Salvez..." : "Salvează"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
