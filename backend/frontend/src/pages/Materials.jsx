import { useEffect, useMemo, useRef, useState } from "react"
import { apiFetch } from "../auth/api"
import { fmtRON } from "../utils/money"
import * as XLSX from "xlsx"
import { useNavigate } from "react-router-dom"

export default function Materials() {
  const [items, setItems] = useState([])
  const [q, setQ] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // add material modal
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState("")
  const [unit, setUnit] = useState("")
  const [sku, setSku] = useState("")
  const [price, setPrice] = useState("")
  const [category, setCategory] = useState("")
  const [saving, setSaving] = useState(false)


  // CRUD: edit + deactivate (soft delete)
  const [showEdit, setShowEdit] = useState(false)
  const [editItem, setEditItem] = useState(null) // {id,name,unit,sku,price,active?}
  const [editName, setEditName] = useState("")
  const [editUnit, setEditUnit] = useState("")
  const [editSku, setEditSku] = useState("")
  const [editPrice, setEditPrice] = useState("")
  const [editCategory, setEditCategory] = useState("")
  const [editActive, setEditActive] = useState(true)
  const [editSaving, setEditSaving] = useState(false)


  // import modal
  const [showImport, setShowImport] = useState(false)
  const [importRows, setImportRows] = useState([])
  const [importing, setImporting] = useState(false)
  const fileRef = useRef(null)

  const navigate = useNavigate()
  const [importResult, setImportResult] = useState(null)

  const debouncedQ = useMemo(() => q.trim(), [q])

  const [sortKey, setSortKey] = useState("name")
  const [sortDir, setSortDir] = useState("asc")


  // pagination
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
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

  const normalizeText = (s) =>
    String(s ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
  
  const parsePrice = (v) => {
    if (v == null) return Number.POSITIVE_INFINITY
    const s = String(v).trim().replace(/\s+/g, "").replace(",", ".")
    const n = Number(s)
    return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY
  }

  const toNumber = (v) => {
    if (v == null) return null
    if (typeof v === "number") return Number.isFinite(v) ? v : null
    const s = String(v).trim().replace(/\s+/g, "").replace(",", ".")
    if (!s) return null
    const n = Number(s)
    return Number.isFinite(n) ? n : null
  }

  
  const filtered = useMemo(() => {
    const safeItems = Array.isArray(items) ? items : []
    const qq = normalizeText(q)
  
    return safeItems
      .filter((p) => {
        if (!qq) return true
        return (
          normalizeText(p?.name).includes(qq) ||
          normalizeText(p?.unit).includes(qq) ||
          normalizeText(p?.sku).includes(qq) ||
          normalizeText(p?.price).includes(qq) ||
          normalizeText(p?.category).includes(qq) ||
          String(p?.id ?? "").includes(qq)
        )
      })
      .sort((a, b) => {
        const dir = sortDir === "desc" ? -1 : 1
        const key = sortKey || "name" // "name" | "unit" | "sku" | "price"
  
        if (key === "price") {
          const ap = parsePrice(a?.price)
          const bp = parsePrice(b?.price)
          if (ap !== bp) return (ap - bp) * dir
          return String(a?.name ?? "").localeCompare(String(b?.name ?? ""), "ro") * dir
        }
  
        const av = String(a?.[key] ?? "")
        const bv = String(b?.[key] ?? "")
        const c = av.localeCompare(bv, "ro")
        if (c !== 0) return c * dir
  
        return String(a?.name ?? "").localeCompare(String(b?.name ?? ""), "ro") * dir
      })
  }, [items, q, sortKey, sortDir])
  
  

    // derived pagination (apply on filtered + sorted list)
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const start = (safePage - 1) * pageSize
  const end = start + pageSize
  const pageRows = filtered.slice(start, end)

  // reset page when query/sort/pageSize changes
  useEffect(() => {
    setPage(1)
  }, [q, sortKey, sortDir, pageSize])

async function load(query) {
    setLoading(true)
    setError(null)
    try {
      const url = query ? `/materials?q=${encodeURIComponent(query)}` : "/materials"
      const data = await apiFetch(url)
      setItems(Array.isArray(data) ? data : (data.value || []))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function createMaterial(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      await apiFetch("/materials", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          unit: unit.trim() || null,
          sku: sku.trim() || null,
          price: toNumber(price),
          category: category.trim() || null,
        }),
      })

      setShowAdd(false)
      setName("")
      setUnit("")
      setSku("")
      setPrice("")
      setCategory("")
      await load(debouncedQ)
    } catch (e2) {
      setError(e2.message)
    } finally {
      setSaving(false)
    }
  }

  // ===== CRUD: edit / deactivate =====
  function openEdit(m) {
    setEditItem(m)
    setEditName(m?.name || "")
    setEditUnit(m?.unit || "")
    setEditSku(m?.sku || "")
    setEditPrice(m?.price == null ? "" : String(m.price))
    setEditCategory(m?.category || "")
    setEditActive(m?.active !== false)
    setShowEdit(true)
  }

  async function saveEdit(e) {
    e.preventDefault()
    if (!editItem?.id) return
    setEditSaving(true)
    setError(null)
    try {
      await apiFetch(`/materials/${editItem.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editName.trim(),
          unit: editUnit.trim() || null,
          sku: editSku.trim() || null,
          price: toNumber(editPrice),
          category: editCategory.trim() || null,
          active: !!editActive,
        }),
      })
      setShowEdit(false)
      setEditItem(null)
      await load(debouncedQ)
    } catch (e2) {
      setError(e2?.message || "Nu pot salva modificările.")
    } finally {
      setEditSaving(false)
    }
  }

  async function deactivateMaterial(m) {
    const ok = window.confirm(`Dezactivezi materialul?\n\n${m.name}${m.sku ? " (SKU: " + m.sku + ")" : ""}`)
    if (!ok) return
    setError(null)
    try {
      await apiFetch(`/materials/${m.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: false }),
      })
      await load(debouncedQ)
    } catch (e2) {
      setError(e2?.message || "Nu pot dezactiva materialul.")
    }
  }

  function normalizeImportRow(r) {
    // Acceptăm coloane cu nume “prietenoase”.
    // Recomandat în Excel:
    // name | sku | unit | price | qty
    const nameVal = (r.name ?? r.Name ?? r.Nume ?? r.Material ?? "").toString().trim()
    const skuVal = (r.sku ?? r.SKU ?? r.Cod ?? r.Code ?? "").toString().trim() || null
    const unitVal = (r.unit ?? r.Unit ?? r.Unitate ?? "").toString().trim() || null
    const priceValRaw = r.price ?? r.Price ?? r.Pret ?? r["Preț"] ?? r["Pret"] ?? null
    const qtyValRaw = r.qty ?? r.Qty ?? r.Cantitate ?? r["Cantitate"] ?? null

    const categoryVal = (r.category ?? r.Category ?? r.Categorie ?? r.Categoria ?? "").toString().trim() || null

    const priceVal = toNumber(priceValRaw)
    const qtyVal = toNumber(qtyValRaw)

    return {
      name: nameVal,
      sku: skuVal,
      unit: unitVal,
      category: categoryVal,
      price: priceVal,
      qty: qtyVal,
    }
  }

  async function onPickExcelFile(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    try {
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data, { type: "array" })
      const sheetName = wb.SheetNames[0]
      const ws = wb.Sheets[sheetName]
      const json = XLSX.utils.sheet_to_json(ws, { defval: "" })

      const rows = json
        .map(normalizeImportRow)
        .filter(r => r.name && r.qty && r.qty > 0)

      if (rows.length === 0) {
        setImportRows([])
        setError("Fișierul nu conține rânduri valide. Ai nevoie minim de: name + qty (>0).")
        return
      }

      setImportRows(rows)
      setShowImport(true)
    } catch (err) {
      setError("Nu am putut citi fișierul Excel.")
    } finally {
      // reset input ca să poți re-alege același fișier
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  async function submitImportToStock() {
    setImporting(true)
    setError(null)
    try {
      // IMPORTANT: endpoint-ul îl facem în backend imediat după
      const res = await apiFetch("/stock/import", {
        method: "POST",
        body: JSON.stringify({
          location_code: "ZOR",
          rows: importRows,
        }),
      })
      
      setImportResult(res)          // păstrăm sumarul
      setShowImport(false)          // închide modal
      setImportRows([])             // curățăm
      navigate("/stoc")             // te duce la Stoc

      setShowImport(false)
      setImportRows([])
      await load(debouncedQ)
    } catch (e) {
      setError(e.message)
    } finally {
      setImporting(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(() => load(debouncedQ), 250)
    return () => clearTimeout(t)
  }, [debouncedQ])

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-xl font-semibold" style={{ color: "var(--yellow)" }}>
          Materiale
        </h1>

        <button 
          onClick={() => load(debouncedQ)}
          className="rounded-xl bg-white/10 px-4 py-2 hover:bg-white/15"
        >
          Reîncarcă
        </button>

        <button
          onClick={() => setShowAdd(true)}
          className="
            group flex items-center gap-2
            px-3 py-2 rounded-lg text-sm
            font-medium
            bg-[var(--yellow)] text-black
            hover:bg-yellow-300
            transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-yellow-400/40
          "
        >
          <span className=" transition-all duration-200 group-hover:font-bold ">
            + Adaugă material
          </span>
        </button>
        <label
          className="
            group flex items-center gap-2
            px-3 py-2 rounded-lg text-sm
            font-medium
            bg-[var(--yellow)] text-black
            hover:bg-yellow-300
            transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-yellow-400/40
            cursor-pointer
          "
          title="Importă .xlsx (coloane recomandate: name, sku, unit, price, qty)"
        >
          <span className="transition-all duration-200 group-hover:font-bold">
            Import Excel → Stoc (Zorilor)
          </span>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={onPickExcelFile}
          />
        </label>

      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Caută material (nume sau SKU)…"
        className="w-full md:w-96 px-3 py-2 rounded bg-black/20 outline-none mb-4"
      />

      {importResult?.ok && (
        <div
          className="mb-4 px-3 py-2 rounded text-sm flex items-center justify-between"
          style={{
            background: "rgba(255,210,0,0.12)",
            border: "1px solid rgba(255,210,0,0.35)",
          }}
        >
          <div>
            <b>Import reușit:</b>{" "}
            create {importResult.materials_created}, existente {importResult.materials_matched},
            mișcări stoc {importResult.stock_movements_added} (locație {importResult.location_code})
          </div>

          <button
            onClick={() => setImportResult(null)}
            className="underline text-sm"
            style={{ color: "var(--yellow)" }}
          >
            ascunde
          </button>
        </div>
      )}

      {loading && <div style={{ color: "var(--muted)" }}>Se încarcă…</div>}
      {error && <div style={{ color: "#f87171" }}>{error}</div>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th 
                className="text-center py-2 px-3 cursor-pointer select-none hover:text-white"
                onClick={() => toggleSort("name")}
                title="Sortează după nume"
              >
                Material{sortArrow("name")}
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
                onClick={() => toggleSort("category")}
                title="Sortează după categorie"
              >
                Categorie{sortArrow("category")}
              </th>
              <th 
                className="text-center py-2 px-3 cursor-pointer select-none hover:text-white"
                onClick={() => toggleSort("price")}
                title="Sortează după pret"
              >
                Preț (listă){sortArrow("price")}
              </th>
              <th 
                className="text-center py-2 px-3 cursor-pointer select-none hover:text-white"
                onClick={() => toggleSort("sku")}
                title="Sortează după SKU"
              >
                SKU{sortArrow("sku")}
              </th>
              <th className="py-2 text-center">Acțiuni</th>
            </tr>
          </thead>

          <tbody>
            {pageRows.map((m) => (
              <tr key={m.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td className="py-2 text-center">{m.name}</td>
                <td className="py-2 text-center" style={{ color: "var(--muted)" }}>
                  {m.unit || "-"}
                </td>
                <td className="py-2 text-center">{m.category || "-"}</td>
                <td className="py-2 text-center font-semibold">
                  {fmtRON(m.price)}
                </td>
                <td className="py-2 text-center">{m.sku || "-"}</td>
                <td className="py-2 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      className="rounded-lg bg-white/10 px-3 py-1.5 hover:bg-white/15"
                      onClick={() => openEdit(m)}
                      title="Editează"
                    >
                      Editează
                    </button>
                    <button
                      className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-1.5 hover:bg-red-500/15 text-red-200"
                      onClick={() => deactivateMaterial(m)}
                      title="Dezactivează (soft delete)"
                    >
                      Dezactivează
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {!loading && items.length === 0 && (
              <tr>
                <td className="py-4 text-center" colSpan={6} style={{ color: "var(--muted)" }}>
                  Nu există rezultate.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
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

          <div className="text-sm text-white/70 min-w-[90px] text-center">
            {safePage} / {pageCount}
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


      {/* ADD MATERIAL MODAL */}
      {showAdd && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="w-full max-w-md rounded p-5" style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: "var(--yellow)" }}>
                Adaugă material
              </h2>
              <button
                onClick={() => { setShowAdd(false); setCategory(""); }}
                className="px-2 py-1 rounded"
                style={{ background: "black" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={createMaterial} className="space-y-3">
              <div>
                <label className="text-xs" style={{ color: "var(--muted)" }}>Nume *</label>
                <input
                  className="w-full px-3 py-2 rounded bg-black/20 outline-none"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs" style={{ color: "var(--muted)" }}>Unitate</label>
                  <input
                    className="w-full px-3 py-2 rounded bg-black/20 outline-none"
                    placeholder="ex: m / buc"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs" style={{ color: "var(--muted)" }}>SKU</label>
                  <input
                    className="w-full px-3 py-2 rounded bg-black/20 outline-none"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                  />
                </div>
              </div>


              <div>
                <label className="text-xs" style={{ color: "var(--muted)" }}>Categorie</label>
                <input
                  className="w-full px-3 py-2 rounded bg-black/20 outline-none"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="ex: PPR, Cupru, Izolații"
                />
              </div>

              <div>
                <label className="text-xs" style={{ color: "var(--muted)" }}>Preț (RON)</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full px-3 py-2 rounded bg-black/20 outline-none"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowAdd(false); setCategory(""); }}
                  className="flex-1 px-3 py-2 rounded"
                  style={{ background: "black" }}
                >
                  Anulează
                </button>

                <button
                  disabled={saving}
                  type="submit"
                  className="flex-1 px-3 py-2 rounded font-medium"
                  style={{ background: "var(--yellow)", color: "#000" }}
                >
                  {saving ? "Salvez..." : "Salvează"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IMPORT MODAL */}
      {showImport && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="w-full max-w-2xl rounded p-5" style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold" style={{ color: "var(--yellow)" }}>
                Import Excel → Stoc (Zorilor)
              </h2>
              <button
                onClick={() => { setShowImport(false); setImportRows([]) }}
                className="px-2 py-1 rounded"
                style={{ background: "black" }}
              >
                ✕
              </button>
            </div>

            <div className="text-sm mb-3" style={{ color: "var(--muted)" }}>
              Acceptă coloane: <b>name</b>, <b>sku</b>, <b>unit</b>, <b>category</b>, <b>price</b>, <b>qty</b> (sau echivalente: Nume, SKU, Unitate, Pret/Preț, Cantitate).
              <br />
              Dacă există deja (după SKU sau nume), îi crește doar stocul.
            </div>

            <div className="overflow-x-auto mb-4" style={{ maxHeight: 260 }}>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th className="py-2 text-left">Nume</th>
                    <th className="py-2 text-center">SKU</th>
                    <th className="py-2 text-center">Unit</th>
                    <th className="py-2 text-center">Categorie</th>
                    <th className="py-2 text-center">Preț</th>
                    <th className="py-2 text-center">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {importRows.slice(0, 20).map((r, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td className="py-2 text-left">{r.name}</td>
                      <td className="py-2 text-center">{r.sku || "-"}</td>
                      <td className="py-2 text-center">{r.unit || "-"}</td>
                      <td className="py-2 text-center">{r.category || "-"}</td>
                      <td className="py-2 text-center">{r.price == null ? "-" : fmtRON(r.price)}</td>
                      <td className="py-2 text-center font-semibold">{r.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowImport(false); setImportRows([]) }}
                className="flex-1 px-3 py-2 rounded"
                style={{ background: "black" }}
              >
                Anulează
              </button>

              <button
                disabled={importing}
                type="button"
                onClick={submitImportToStock}
                className="flex-1 px-3 py-2 rounded font-medium"
                style={{ background: "var(--yellow)", color: "#000" }}
              >
                {importing ? "Import..." : `Importă (${importRows.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Modal edit material ===== */}
      {showEdit && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.65)" }}>
          <div className="w-full max-w-xl rounded-2xl p-5 border border-white/10" style={{ background: "var(--panel)" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: "var(--yellow)" }}>
                Editează material
              </h2>
              <button onClick={() => setShowEdit(false)} className="px-2 py-1 rounded bg-black">
                ✕
              </button>
            </div>

            <form onSubmit={saveEdit} className="space-y-3">
              <div>
                <label className="text-xs" style={{ color: "var(--muted)" }}>Nume *</label>
                <input
                  className="w-full px-3 py-2 rounded bg-black/20 outline-none"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs" style={{ color: "var(--muted)" }}>Unitate</label>
                  <input
                    className="w-full px-3 py-2 rounded bg-black/20 outline-none"
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    placeholder="ex: m, buc"
                  />
                </div>
                <div>
                  <label className="text-xs" style={{ color: "var(--muted)" }}>SKU</label>
                  <input
                    className="w-full px-3 py-2 rounded bg-black/20 outline-none"
                    value={editSku}
                    onChange={(e) => setEditSku(e.target.value)}
                    placeholder="opțional"
                  />
                </div>
              </div>


              <div>
                <label className="text-xs" style={{ color: "var(--muted)" }}>Categorie</label>
                <input
                  className="w-full px-3 py-2 rounded bg-black/20 outline-none"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  placeholder="ex: PPR, Cupru, Izolații"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs" style={{ color: "var(--muted)" }}>Preț (listă)</label>
                  <input
                    className="w-full px-3 py-2 rounded bg-black/20 outline-none"
                    inputMode="decimal"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    placeholder="opțional"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm opacity-80 mt-6">
                  <input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} />
                  Activ
                </label>
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
