'use client'
import { useState, useRef } from 'react'
import ExcelJS from 'exceljs'
import { store, Category } from '@/lib/store'
import { compressImage, extractZip, barcodeKey } from '@/lib/imageUtils'

interface ParsedRow {
  name: string
  categoryId: string
  price: number
  unit: string
  stock: number
  barcode: string
  description?: string
  imageBlob?: Blob
  imageUrl?: string
  imagePreview?: string
  matched: boolean
}

interface Props {
  wholesalerId: string
  categories: Category[]
  onDone: () => void
}

type Step = 'upload' | 'preview' | 'importing' | 'done'

export default function BulkImport({ wholesalerId, categories, onDone }: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [progress, setProgress] = useState(0)
  const [progressMsg, setProgressMsg] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [result, setResult] = useState<{ ok: number; skipped: number } | null>(null)
  const excelRef = useRef<HTMLInputElement>(null)
  const zipRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLInputElement>(null)
  const [excelFile, setExcelFile] = useState<File | null>(null)
  const [imageMap, setImageMap] = useState<Map<string, Blob>>(new Map())
  const [parsing, setParsing] = useState(false)

  // ── Step 1a: parse Excel (auto-create unknown categories) ──
  async function handleExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setParsing(true)
    setExcelFile(file)
    try {
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(await file.arrayBuffer())
      const ws = wb.getWorksheet('商品导入') || wb.worksheets[0]
      const parsed: ParsedRow[] = []
      const errs: string[] = []

      // local cache so the same new category isn't created twice
      const localCats = [...categories]
      const newCatNames: string[] = []

      // collect all rows first
      const rawRows: { name: string; catRaw: string; priceRaw: any; unit: string; stockRaw: any; barcode: string; description: string; rowNum: number }[] = []
      ws.eachRow((row, rowNum) => {
        if (rowNum <= 2) return
        const name = (row.getCell(1).text || '').trim()
        if (!name) return
        rawRows.push({
          name,
          catRaw: (row.getCell(2).text || '').trim(),
          priceRaw: row.getCell(3).value,
          unit: (row.getCell(4).text || '').trim(),
          stockRaw: row.getCell(5).value,
          barcode: (row.getCell(6).text || '').trim(),
          description: (row.getCell(7).text || '').trim(),
          rowNum,
        })
      })

      // auto-create missing categories
      for (const r of rawRows) {
        if (!r.catRaw) continue
        const exists = localCats.find(c => c.name === r.catRaw)
        if (!exists && !newCatNames.includes(r.catRaw)) {
          newCatNames.push(r.catRaw)
          const newCat = await store.addCategory(r.catRaw, wholesalerId)
          localCats.push(newCat)
        }
      }

      // now build rows
      for (const r of rawRows) {
        if (!r.catRaw || !r.priceRaw || !r.unit) { errs.push(`第${r.rowNum}行 "${r.name}": 缺少必填字段(分类/价格/单位)`); continue }
        const cat = localCats.find(c => c.name === r.catRaw)!
        parsed.push({ name: r.name, categoryId: cat.id, price: Number(r.priceRaw), unit: r.unit, stock: Number(r.stockRaw) || 0, barcode: r.barcode, description: r.description || undefined, matched: false })
      }

      if (newCatNames.length > 0) errs.unshift(`✅ 自动新建分类：${newCatNames.join('、')}`)
      setRows(parsed); setErrors(errs)
    } catch { setErrors(['Excel 解析失败，请检查文件格式']) }
    setParsing(false)
    e.target.value = ''
  }

  // ── Step 1b: load images from ZIP ──
  async function handleZip(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setParsing(true)
    try {
      const map = await extractZip(file)
      setImageMap(prev => new Map([...prev, ...map]))
    } catch { setErrors(p => [...p, 'ZIP 解析失败']) }
    setParsing(false)
    e.target.value = ''
  }

  // ── Step 1c: load images from multi-select ──
  async function handleImages(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    const map = new Map<string, Blob>()
    files.forEach(f => map.set(f.name.toLowerCase(), f))
    setImageMap(prev => new Map([...prev, ...map]))
    e.target.value = ''
  }

  // ── Step 1 → 2: match + preview ──
  async function doMatch() {
    if (rows.length === 0) return
    const matched = await Promise.all(rows.map(async row => {
      // match by barcode OR product name (both stripped of spaces/symbols)
      const barcodeK = barcodeKey(row.barcode)
      const nameK = barcodeKey(row.name)
      let blob: Blob | undefined
      for (const [fname, b] of imageMap) {
        const fk = barcodeKey(fname)
        if ((barcodeK && fk === barcodeK) || fk === nameK) { blob = b; break }
      }
      let preview: string | undefined
      if (blob) {
        try {
          const compressed = await compressImage(blob)
          preview = URL.createObjectURL(compressed)
          return { ...row, imageBlob: compressed, imagePreview: preview, matched: true }
        } catch { /* skip bad image */ }
      }
      return { ...row, matched: false }
    }))
    setRows(matched)
    setStep('preview')
  }

  // ── Step 2 → 3: import ──
  async function doImport() {
    setStep('importing')
    let ok = 0; let skipped = 0
    const total = rows.length
    const errs: string[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      setProgress(Math.round((i / total) * 100))
      setProgressMsg(`正在处理: ${row.name} (${i + 1}/${total})`)
      try {
        let imageUrl: string | undefined
        if (row.imageBlob) {
          try {
            imageUrl = await store.uploadProductImage(wholesalerId, barcodeKey(row.barcode || row.name) || `p${Date.now()}`, row.imageBlob)
          } catch (e: any) { errs.push(`${row.name} 图片上传失败: ${e.message}`) }
        }
        await store.addProduct({ name: row.name, categoryId: row.categoryId, price: row.price, unit: row.unit, stock: row.stock, barcode: row.barcode || undefined, description: row.description, image: imageUrl }, wholesalerId)
        ok++
      } catch (e: any) { errs.push(`${row.name}: ${e.message}`); skipped++ }
    }

    setProgress(100)
    setProgressMsg('完成！')
    setErrors(errs)
    setResult({ ok, skipped })
    setStep('done')
  }

  const matchedCount = rows.filter(r => r.matched).length

  return (
    <div className="max-w-2xl">
      {/* ── Step: upload ── */}
      {step === 'upload' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <div className="text-sm font-medium text-gray-700 mb-3">① 上传商品表（Excel）</div>
            <p className="text-xs text-gray-400 mb-3">第6列填条码，系统用条码匹配图片。无条码填唯一货号。</p>
            <div className="flex gap-3">
              <button onClick={() => excelRef.current?.click()} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">
                📋 选择 Excel 文件
              </button>
              {excelFile && <span className="text-sm text-green-600 flex items-center">✓ {excelFile.name}（{rows.length} 条商品）</span>}
            </div>
            <input ref={excelRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcel} />
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm">
            <div className="text-sm font-medium text-gray-700 mb-1">② 上传图片（按条码命名）</div>
            <p className="text-xs text-gray-400 mb-3">图片文件名 = 条码，如 <code className="bg-gray-100 px-1 rounded">8001234567.jpg</code>。支持 ZIP 打包或多选图片。</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => zipRef.current?.click()} className="flex flex-col items-center gap-1.5 p-4 border-2 border-dashed border-gray-200 rounded-xl hover:border-orange-400 hover:bg-orange-50 transition-colors">
                <span className="text-2xl">📦</span>
                <span className="text-sm font-medium text-gray-700">上传 ZIP 图片包</span>
                <span className="text-xs text-gray-400">所有图片打包成 .zip</span>
              </button>
              <button onClick={() => imgRef.current?.click()} className="flex flex-col items-center gap-1.5 p-4 border-2 border-dashed border-gray-200 rounded-xl hover:border-orange-400 hover:bg-orange-50 transition-colors">
                <span className="text-2xl">🖼️</span>
                <span className="text-sm font-medium text-gray-700">多选图片文件</span>
                <span className="text-xs text-gray-400">直接选多张图片</span>
              </button>
            </div>
            <input ref={zipRef} type="file" accept=".zip" className="hidden" onChange={handleZip} />
            <input ref={imgRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImages} />
            {imageMap.size > 0 && (
              <div className="mt-3">
                <div className="text-sm text-green-600 mb-1">✓ 已加载 {imageMap.size} 张图片，检测到的文件名：</div>
                <div className="bg-gray-50 rounded-lg p-2 max-h-24 overflow-y-auto">
                  {[...imageMap.keys()].map(name => (
                    <div key={name} className="text-xs text-gray-500 font-mono">{name}</div>
                  ))}
                </div>
                <div className="text-xs text-gray-400 mt-1">图片文件名需和条码列一致（或和商品名一致），系统会自动配对</div>
              </div>
            )}
          </div>

          {errors.length > 0 && (
            <div className="bg-red-50 rounded-xl p-4">
              <div className="text-sm font-medium text-red-600 mb-1">解析问题：</div>
              {errors.slice(0, 5).map((e, i) => <div key={i} className="text-xs text-red-500">• {e}</div>)}
              {errors.length > 5 && <div className="text-xs text-red-400">…还有 {errors.length - 5} 条</div>}
            </div>
          )}

          {rows.length > 0 && (
            <button onClick={doMatch} disabled={parsing}
              className="w-full py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-60">
              {parsing ? '处理中…' : `下一步：预览匹配结果（${rows.length} 条商品）`}
            </button>
          )}

          <div className="bg-blue-50 rounded-xl p-4 text-xs text-blue-700 space-y-1">
            <div className="font-medium mb-1">📌 操作说明</div>
            <div>1. 用批发商端「下载导入模板」下载 Excel</div>
            <div>2. 填写商品信息，<strong>第6列条码</strong>很关键</div>
            <div>3. 把商品图片改名为对应条码（如 <code className="bg-blue-100 px-1 rounded">8001234567.jpg</code>）</div>
            <div>4. 上传 Excel + 图片（ZIP 或多选），系统自动配对</div>
            <div>5. 图片自动压缩到 1200px 高清，体积减 90%+</div>
          </div>
        </div>
      )}

      {/* ── Step: preview ── */}
      {step === 'preview' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-semibold text-gray-800">{rows.length} 条商品</div>
              <div className="text-sm text-gray-500">
                <span className="text-green-600">{matchedCount} 条匹配到图片</span>
                {rows.length - matchedCount > 0 && <span className="text-gray-400 ml-2">{rows.length - matchedCount} 条无图（仍可导入）</span>}
              </div>
            </div>
            <button onClick={() => { setStep('upload'); setRows([]) }} className="text-sm text-gray-400 hover:text-gray-600">← 重新上传</button>
          </div>

          <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100 mb-4 max-h-96 overflow-y-auto">
            {rows.map((row, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center shrink-0">
                  {row.imagePreview ? <img src={row.imagePreview} className="w-full h-full object-cover" alt="" /> : <span className="text-gray-300 text-lg">📦</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">{row.name}</div>
                  <div className="text-xs text-gray-400">{categories.find(c => c.id === row.categoryId)?.name} · €{row.price} / {row.unit} · 库存 {row.stock}</div>
                </div>
                {row.matched
                  ? <span className="text-xs text-green-500 shrink-0">✓ 有图</span>
                  : <span className="text-xs text-gray-300 shrink-0">无图</span>}
              </div>
            ))}
          </div>

          <button onClick={doImport}
            className="w-full py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600">
            确认导入全部 {rows.length} 条商品
          </button>
        </div>
      )}

      {/* ── Step: importing ── */}
      {step === 'importing' && (
        <div className="bg-white rounded-xl p-8 shadow-sm text-center">
          <div className="text-3xl mb-4">⏳</div>
          <div className="font-semibold text-gray-800 mb-2">正在导入…</div>
          <div className="text-sm text-gray-500 mb-4">{progressMsg}</div>
          <div className="w-full bg-gray-100 rounded-full h-3 mb-2">
            <div className="bg-orange-500 h-3 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="text-xs text-gray-400">{progress}%</div>
        </div>
      )}

      {/* ── Step: done ── */}
      {step === 'done' && result && (
        <div>
          <div className={`rounded-xl p-6 mb-4 text-center ${result.ok > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className="text-4xl mb-3">{result.ok > 0 ? '🎉' : '⚠️'}</div>
            <div className="font-bold text-lg text-gray-800 mb-1">导入完成</div>
            <div className="text-green-600 font-medium">✅ 成功 {result.ok} 条（含 {rows.filter(r => r.matched).length} 张图片）</div>
            {result.skipped > 0 && <div className="text-red-500 text-sm mt-1">❌ 失败 {result.skipped} 条</div>}
          </div>
          {errors.length > 0 && (
            <div className="bg-red-50 rounded-xl p-4 mb-4">
              <div className="text-sm font-medium text-red-600 mb-1">失败详情：</div>
              {errors.map((e, i) => <div key={i} className="text-xs text-red-500">• {e}</div>)}
            </div>
          )}
          <button onClick={onDone} className="w-full py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600">
            返回商品管理
          </button>
        </div>
      )}
    </div>
  )
}
