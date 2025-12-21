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
  const [saving, setSaving] = useState(false)

  // import modal
  const [showImport, setShowImport] = useState(false)
  const [importRows, setImportRows] = useState([])
  const [importing, setImporting] = useState(false)
  const fileRef = useRef(null)

  const navigate = useNavigate()
  const [importResult, setImportResult] = useState(null)

  const debouncedQ = useMemo(() => q.trim(), [q])

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
          price: price === "" ? null : Number(price),
        }),
      })

      setShowAdd(false)
      setName("")
      setUnit("")
      setSku("")
      setPrice("")
      await load(debouncedQ)
    } catch (e2) {
      setError(e2.message)
    } finally {
      setSaving(false)
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

    const priceVal = priceValRaw === null || priceValRaw === "" ? null : Number(priceValRaw)
    const qtyVal = qtyValRaw === null || qtyValRaw === "" ? null : Number(qtyValRaw)

    return {
      name: nameVal,
      sku: skuVal,
      unit: unitVal,
      price: Number.isFinite(priceVal) ? priceVal : null,
      qty: Number.isFinite(qtyVal) ? qtyVal : null,
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
          className="px-3 py-2 rounded text-sm"
          style={{ background: "var(--panel)" }}
        >
          Reîncarcă
        </button>

        <button
          onClick={() => setShowAdd(true)}
          className="px-3 py-2 rounded text-sm font-medium"
          style={{ background: "var(--yellow)", color: "#000" }}
        >
          + Adaugă material
        </button>

        <label
          className="px-3 py-2 rounded text-sm font-medium cursor-pointer"
          style={{ background: "var(--panel)" }}
          title='Importă .xlsx (coloane recomandate: name, sku, unit, price, qty)'
        >
          Import Excel → Stoc (Zorilor)
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
              <th className="py-2 text-left">Material</th>
              <th className="py-2 text-center">Unitate</th>
              <th className="py-2 text-center">SKU</th>
              <th className="py-2 text-center">Preț (listă)</th>
            </tr>
          </thead>

          <tbody>
            {items.map((m) => (
              <tr key={m.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td className="py-2 text-left">{m.name}</td>
                <td className="py-2 text-center" style={{ color: "var(--muted)" }}>
                  {m.unit || "-"}
                </td>
                <td className="py-2 text-center">{m.sku || "-"}</td>
                <td className="py-2 text-center font-semibold">
                  {fmtRON(m.price)}
                </td>
              </tr>
            ))}

            {!loading && items.length === 0 && (
              <tr>
                <td className="py-4 text-center" colSpan={4} style={{ color: "var(--muted)" }}>
                  Nu există rezultate.
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
                onClick={() => setShowAdd(false)}
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
                  onClick={() => setShowAdd(false)}
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
              Acceptă coloane: <b>name</b>, <b>sku</b>, <b>unit</b>, <b>price</b>, <b>qty</b> (sau echivalente: Nume, SKU, Unitate, Pret/Preț, Cantitate).
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
    </div>
  )
}
