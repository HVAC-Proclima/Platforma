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

// jsPDF default fonts often don't render Romanian diacritics.
// Workaround: remove diacritics in the PDF export text.
function stripDiacritics(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // extra safety for Romanian-specific letters
    .replace(/ș/g, "s")
    .replace(/Ș/g, "S")
    .replace(/ț/g, "t")
    .replace(/Ț/g, "T")
    .replace(/ă/g, "a")
    .replace(/Ă/g, "A")
    .replace(/î/g, "i")
    .replace(/Î/g, "I")
    .replace(/â/g, "a")
    .replace(/Â/g, "A")
}

export default function Stock() {
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  const [all, setAll] = useState([]) // rows from /stock
  const [locFilter, setLocFilter] = useState("ZOR") // ALL | ZOR | IRS
  const [q, setQ] = useState("")

  // export
  const [showExport, setShowExport] = useState(false)
  const [exportLoc, setExportLoc] = useState("ZOR") // ZOR (default) | IRS | ALL

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

  // =================== sorting state ===================
  const [sortKey, setSortKey] = useState("material_name")
  const [sortDir, setSortDir] = useState("asc") // "asc" | "desc"


  // pagination
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  // =================== sort handlers ===================
  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
      return
    }
    setSortKey(key)
    setSortDir("asc")
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

  const parseNumber = (v, invalidDefault) => {
    if (typeof v === "number") return Number.isFinite(v) ? v : invalidDefault
    if (v == null || v === "") return invalidDefault

    let s = String(v).trim().replace(/\s+/g, "") // remove spaces: "1 234,56"

    // keep only digits, separators and minus
    s = s.replace(/[^0-9,\.\-]/g, "")

    const hasComma = s.includes(",")
    const hasDot = s.includes(".")

    if (hasComma && hasDot) {
      // assume European: dot thousands + comma decimals  "1.234,56"
      s = s.replace(/\./g, "").replace(",", ".")
    } else if (hasComma && !hasDot) {
      // comma as decimal: "1234,56"
      s = s.replace(",", ".")
    } else {
      // dot as decimal or integer; remove commas as thousands: "1,234.56"
      s = s.replace(/,/g, "")
    }

    const n = Number(s)
    return Number.isFinite(n) ? n : invalidDefault
  }

  const toNumberSort = (v) => parseNumber(v, Number.NEGATIVE_INFINITY)

  const toNumberSafe = (v) => parseNumber(v, 0)

  // =================== export helpers ===================
  function tableLikeRowsForExport() {
    // Export "ca in tabel": aplica aceeasi cautare (q) + aceeasi sortare ca tabelul,
    // dar cu locația aleasă din modal (exportLoc).
    const qq = normalizeText(q)
    const rows = Array.isArray(all) ? all : []
    const loc = String(exportLoc || "ZOR").toUpperCase()

    const out = rows
      .filter((r) => {
        const okLoc =
          loc === "ALL" ? true : String(r.location_code ?? "").toUpperCase() === loc
        if (!okLoc) return false
        if (!qq) return true

        const hay = normalizeText(
          `${r.material_name ?? ""} ${r.category ?? ""} ${r.location_name ?? ""} ${r.location_code ?? ""} ${r.sku ?? ""}`
        )
        return hay.includes(qq)
      })
      .sort((a, b) => {
        const dir = sortDir === "desc" ? -1 : 1
        const key = sortKey || "material_name"

        if (["qty", "unit_price", "total_value"].includes(key)) {
          const av = toNumberSort(a?.[key])
          const bv = toNumberSort(b?.[key])
          if (av !== bv) return (av - bv) * dir
          return String(a?.material_name ?? "").localeCompare(String(b?.material_name ?? ""), "ro") * dir
        }

        const av = String(a?.[key] ?? "")
        const bv = String(b?.[key] ?? "")
        const c = av.localeCompare(bv, "ro")
        if (c !== 0) return c * dir
        return String(a?.material_name ?? "").localeCompare(String(b?.material_name ?? ""), "ro") * dir
      })

    return out
  }

  function buildExportRows() {
    return tableLikeRowsForExport().map((r) => {
      const qty = toNumberSafe(r?.qty)
      const unitPrice = toNumberSafe(r?.unit_price)
      const totalValue = Number.isFinite(toNumberSort(r?.total_value))
        ? toNumberSort(r?.total_value)
        : qty * unitPrice

      return {
        Material: r?.material_name ?? "",
        Categorie: r?.category ?? "",
        Cantitate: qty,
        UM: r?.unit ?? "",
        "Preț unitar": unitPrice,
        Valoare: totalValue,
        "Locație": r?.location_name ?? r?.location_code ?? "",
      }
    })
  }

  function exportTotals(rows) {
    const totalQty = rows.reduce((acc, r) => acc + toNumberSafe(r?.Cantitate), 0)
    const totalValue = rows.reduce((acc, r) => acc + toNumberSafe(r?.Valoare), 0)
    return { totalQty, totalValue }
  }

  function downloadBlob(content, filename, mime) {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function exportExcel() {
    const rows = buildExportRows()
    if (!rows.length) {
      setToast({ type: "error", msg: "Nu există date de exportat." })
      return
    }

    const totals = exportTotals(rows)
    const rowsWithTotal = [
      ...rows,
      {
        Material: "TOTAL",
        Categorie: "",
        Cantitate: totals.totalQty,
        UM: "",
        "Preț unitar": "",
        Valoare: totals.totalValue,
        "Locație": "",
      },
    ]

    const locName = exportLoc === "ALL" ? "complet" : (locCodeToName[exportLoc] || exportLoc).toLowerCase()
    const datePart = new Date().toISOString().slice(0, 10)

    // Prefer real .xlsx (best compatibility). Fallback to .tsv if lib isn't installed.
    try {
      const XLSX = await import("xlsx")
      const ws = XLSX.utils.json_to_sheet(rowsWithTotal)
      // basic column widths
      ws["!cols"] = Object.keys(rowsWithTotal[0]).map((k) => ({ wch: Math.min(40, Math.max(10, String(k).length + 4)) }))
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Stoc")
      XLSX.writeFile(wb, `stoc_${locName}_${datePart}.xlsx`)
      setShowExport(false)
      return
    } catch {
      // Fallback: TSV (Excel îl deschide și împarte corect coloanele)
      const headers = Object.keys(rowsWithTotal[0])
      const sep = "\t"
      const esc = (v) => String(v ?? "").replace(/\t/g, " ").replace(/\r?\n/g, " ")
      const lines = [headers.join(sep), ...rowsWithTotal.map((r) => headers.map((h) => esc(r[h])).join(sep))]
      downloadBlob("\ufeff" + lines.join("\r\n"), `stoc_${locName}_${datePart}.tsv`, "text/tab-separated-values;charset=utf-8")
      setShowExport(false)
    }
  }

  async function exportPdf() {
    const rows = buildExportRows()
    if (!rows.length) {
      setToast({ type: "error", msg: "Nu există date de exportat." })
      return
    }

    const totals = exportTotals(rows)

    const locLabel = exportLoc === "ALL" ? "Stoc complet" : `Stoc ${locCodeToName[exportLoc] || exportLoc}`
    const locName = exportLoc === "ALL" ? "complet" : (locCodeToName[exportLoc] || exportLoc).toLowerCase()
    const datePart = new Date().toISOString().slice(0, 10)

    try {
      const { jsPDF } = await import("jspdf")
      const autoTable = (await import("jspdf-autotable")).default
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" })

      doc.setFontSize(14)
      doc.text(stripDiacritics(locLabel), 40, 40)
      doc.setFontSize(10)
      doc.text(stripDiacritics(`Generat: ${new Date().toLocaleString("ro-RO")} • Elemente: ${rows.length}`), 40, 58)

      const head = [[
        "Material",
        "Categorie",
        "Cantitate",
        "UM",
        "Pret unitar (RON)",
        "Valoare (RON)",
        "Locatie",
      ]]
      const body = rows.map((r) => [
        stripDiacritics(String(r.Material ?? "")),
        stripDiacritics(String(r.Categorie ?? "")),
        Number(r.Cantitate || 0).toFixed(2),
        stripDiacritics(String(r.UM ?? "")),
        Number(r["Preț unitar"] || 0).toFixed(2),
        Number(r.Valoare || 0).toFixed(2),
        stripDiacritics(String(r["Locație"] ?? "")),
      ])

      autoTable(doc, {
        head,
        body,
        startY: 72,
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [240, 240, 240], textColor: 20 },
        columnStyles: { 2: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
      })

      const y = (doc.lastAutoTable?.finalY ?? 72) + 18
      doc.setFontSize(11)
      doc.text(
        stripDiacritics(
          `TOTAL: Cantitate = ${totals.totalQty.toFixed(2)} • Valoare = ${totals.totalValue.toFixed(2)} RON`
        ),
        40,
        y
      )

      doc.save(`stoc_${locName}_${datePart}.pdf`)
      setShowExport(false)
    } catch {
      setToast({ type: "error", msg: "Pentru PDF: instalează 'jspdf' și 'jspdf-autotable'." })
    }
  }


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
          `${r.material_name ?? ""} ${r.category ?? ""} ${r.location_name ?? ""} ${r.location_code ?? ""} ${r.sku ?? ""}`
        )

        return hay.includes(qq)
      })
      .sort((a, b) => {
        const dir = sortDir === "desc" ? -1 : 1
        const key = sortKey || "material_name"

        // numeric columns
        if (["qty", "unit_price", "total_value"].includes(key)) {
          const av = toNumberSort(a?.[key])
          const bv = toNumberSort(b?.[key])
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


// derived pagination (apply on filtered + sorted list)
const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
const safePage = Math.min(page, pageCount)
const start = (safePage - 1) * pageSize
const end = start + pageSize
const pageRows = filtered.slice(start, end)

// reset page when query/sort/pageSize/location changes
useEffect(() => {
  setPage(1)
}, [q, sortKey, sortDir, pageSize, locFilter])


  // =================== total value ===================
  const totalValue = useMemo(() => {
    return filtered.reduce((acc, r) => {
      const tv = toNumberSort(r?.total_value)
      if (Number.isFinite(tv)) return acc + tv

      // fallback: qty * unit_price
      const qn = toNumberSafe(r?.qty)
      const pn = toNumberSafe(r?.unit_price)
      return acc + qn * pn
    }, 0)
  }, [filtered])

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
          onClick={() => setShowIn(true)}
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
            + Intrare stoc
          </span>
        </button>

        <button
          onClick={() => {
            setExportLoc("ZOR")
            setShowExport(true)
          }}
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
            Export stoc
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
                  onClick={() => toggleSort("category")}
                  title="Sortează după categorie"
                >
                  Categorie{sortArrow("category")}
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
              {pageRows.map((r, idx) => (
                <tr key={`${r.material_id}-${r.location_id}-${idx}`} className="border-t border-white/5">
                  <td className="py-3 px-3 text-center font-semibold">{r.material_name}</td>
                  <td className="py-3 px-3 text-center">{r.category || "-"}</td>
                  <td className="py-3 px-3 text-center">{Number(r.qty || 0).toFixed(2)}</td>
                  <td className="py-3 px-3 text-center">{r.unit || "-"}</td>
                  <td className="py-3 px-3 text-center">{money(r.unit_price)}</td>
                  <td className="py-3 px-3 text-center font-semibold">{money(Number.isFinite(toNumberSort(r.total_value)) ? toNumberSort(r.total_value) : toNumberSafe(r.qty) * toNumberSafe(r.unit_price))}</td>
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
                  <td colSpan={8} className="py-10 text-center opacity-70">
                    Nu există poziții.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

<div className="mt-4 flex items-center justify-between gap-2">
  <div className="text-sm text-white/60">
    Afișez <span className="text-white/80">{filtered.length ? start + 1 : 0}</span>–
    <span className="text-white/80">{Math.min(end, filtered.length)}</span> din{" "}
    <span className="text-white/80">{filtered.length}</span>
  </div>

  <div className="flex items-center gap-2">
    <select
      value={pageSize}
      onChange={(e) => setPageSize(Number(e.target.value))}
      className="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-sm outline-none"
      title="Rânduri/pagină"
    >
      {[20, 50, 100, 200].map((n) => (
        <option key={n} value={n}>
          {n}/pag
        </option>
      ))}
    </select>

    <button
      className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40"
      onClick={() => setPage((p) => Math.max(1, p - 1))}
      disabled={safePage <= 1}
      title="Pagina anterioară"
    >
      ‹
    </button>

    <div className="text-sm text-white/70 min-w-[84px] text-center">
      {safePage}/{pageCount}
    </div>

    <button
      className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40"
      onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
      disabled={safePage >= pageCount}
      title="Pagina următoare"
    >
      ›
    </button>
  </div>
</div>

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
              <div><span className="opacity-60">Categorie:</span> {adjustRow.category || "-"}</div>
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
                          {m.sku ? `SKU: ${m.sku} • ` : ""}{m.category ? `Cat: ${m.category} • ` : ""}UM: {m.unit || "-"} • Preț listă: {money(m.price)}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {inSelectedMat && (
                  <div className="text-xs opacity-80 mt-1">
                    Selectat: <span className="font-semibold">{inSelectedMat.name}</span> (Cat: {inSelectedMat.category || "—"} • UM: {inSelectedMat.unit || "—"})
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
    {/* ===== Modal: Export ===== */}
{showExport && (
  <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.65)" }}>
    <div className="w-full max-w-md rounded-2xl p-5 border border-white/10" style={{ background: "var(--panel)" }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold" style={{ color: "var(--yellow)" }}>
          Export stoc
        </h2>
        <button onClick={() => setShowExport(false)} className="px-2 py-1 rounded bg-black">
          ✕
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs" style={{ color: "var(--muted)" }}>
            Selectează stocul
          </label>
          <select
            className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 outline-none"
            value={exportLoc}
            onChange={(e) => setExportLoc(e.target.value)}
          >
            <option value="ZOR">Zorilor (default)</option>
            <option value="IRS">Iris</option>
            <option value="ALL">Stoc complet</option>
          </select>
          <div className="text-xs opacity-70 mt-2">
            Export PDF/Excel: pentru rezultate perfecte, instalează librăriile (vezi instrucțiunile de mai jos).
            Dacă nu ai „xlsx” instalat, Excel se exportă ca TSV (se deschide corect în Excel).
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={() => setShowExport(false)}
            className="flex-1 px-3 py-2 rounded bg-black"
          >
            Anulează
          </button>
        
          <button
          onClick={exportExcel}
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
            Export Excel
          </span>
        </button>

        <button
          onClick={exportPdf}
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
            Export PDF
          </span>
        </button>

        </div>
      </div>
    </div>
  </div>
)}

    </div>

  )
}
