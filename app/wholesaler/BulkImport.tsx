'use client'
import { useState, useRef } from 'react'
import ExcelJS from 'exceljs'
import { store, Category } from '@/lib/store'
import { exportProductTemplate } from '@/lib/excel'
import { compressImage, extractZip, barcodeKey, ZipImage } from '@/lib/imageUtils'

interface ParsedRow {
  sku: string
  name: string
  categoryId: string
  categoryName?: string  // from Excel column J — fallback when no ZIP folder
  subcategory?: string   // from Excel column K
  price: number
  unit: string
  boxQty?: number
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
  const imgOnlyRef = useRef<HTMLInputElement>(null)
  const zipOnlyRef = useRef<HTMLInputElement>(null)
  const [excelFile, setExcelFile] = useState<File | null>(null)
  const [imageMap, setImageMap] = useState<Map<string, ZipImage>>(new Map())
  const [imgOnlyMap, setImgOnlyMap] = useState<Map<string, ZipImage>>(new Map())
  const [parsing, setParsing] = useState(false)
  const [imgOnlyProgress, setImgOnlyProgress] = useState(0)
  const [imgOnlyMsg, setImgOnlyMsg] = useState('')
  const [imgOnlyDone, setImgOnlyDone] = useState<{ ok: number; skipped: number; unmatched: string[] } | null>(null)
  const [imgOnlyRunning, setImgOnlyRunning] = useState(false)

  // ── Step 1a: parse Excel — 新列顺序: 名称/价格/单位/库存/条码/描述 (无分类列) ──
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

      ws.eachRow((row, rowNum) => {
        if (rowNum <= 2) return
        // A=编号  B=条形码  C=中文名  D=西文名  E=分类  F=子分类  G=包装数  H=装箱数  I=售价  J=IVA  K=库存
        const sku          = (row.getCell(1).text || '').trim()
        const barcode      = (row.getCell(2).text || '').trim()
        const name         = (row.getCell(3).text || '').trim()
        if (!name) return
        const desc         = (row.getCell(4).text || '').trim()
        const categoryName = (row.getCell(5).text || '').trim() || undefined
        const subcategory  = (row.getCell(6).text || '').trim() || undefined
        const unit         = (row.getCell(7).text || '').trim()
        const boxQtyRaw    = row.getCell(8).value
        const priceRaw     = row.getCell(9).value
        const stockRaw     = row.getCell(11).value
        if (!priceRaw || !unit) { errs.push(`第${rowNum}行 "${name}": 缺少售价或包装数`); return }
        const boxQty = boxQtyRaw ? Number(boxQtyRaw) || undefined : undefined
        // categoryId 留空，由 ZIP 文件夹（优先）或 J 列分类名在 doMatch 阶段填入
        parsed.push({ sku, name, categoryId: '', categoryName, subcategory, price: Number(priceRaw), unit, boxQty, stock: Number(stockRaw) || 0, barcode, description: desc || undefined, matched: false })
      })

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

  // ── Step 1c: load images from multi-select (no folder category info) ──
  async function handleImages(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    const map = new Map<string, ZipImage>()
    files.forEach(f => map.set(barcodeKey(f.name), { blob: f }))
    setImageMap(prev => new Map([...prev, ...map]))
    e.target.value = ''
  }

  // ── Step 1 → 2: match + preview, apply folder-based category override ──
  async function doMatch() {
    if (rows.length === 0) return

    // collect new categories from ZIP folders first
    const localCats = [...categories]
    const folderCats = new Set<string>()
    for (const [, zi] of imageMap) {
      if (zi.category) folderCats.add(zi.category)
    }
    const newCatMsgs: string[] = []
    for (const catName of folderCats) {
      if (!localCats.find(c => c.name === catName)) {
        const nc = await store.addCategory(catName, wholesalerId)
        localCats.push(nc)
        newCatMsgs.push(catName)
      }
    }
    if (newCatMsgs.length > 0) {
      setErrors(p => [`✅ 从文件夹新建分类：${newCatMsgs.join('、')}`, ...p])
    }

    const matched = await Promise.all(rows.map(async row => {
      const skuK     = barcodeKey(row.sku)      // 编号优先
      const barcodeK = barcodeKey(row.barcode)  // 条形码次之
      const nameK    = barcodeKey(row.name)     // 商品名兜底
      let zipImg: ZipImage | undefined
      for (const [key, zi] of imageMap) {
        if ((skuK && key === skuK) || (barcodeK && key === barcodeK) || key === nameK) { zipImg = zi; break }
      }

      // Category priority: ZIP folder > Excel J column > empty
      let categoryId = row.categoryId
      if (zipImg?.category) {
        const cat = localCats.find(c => c.name === zipImg!.category)
        if (cat) categoryId = cat.id
      }
      if (!categoryId && row.categoryName) {
        let cat = localCats.find(c => c.name === row.categoryName)
        if (!cat) {
          cat = await store.addCategory(row.categoryName!, wholesalerId)
          localCats.push(cat)
        }
        categoryId = cat.id
      }

      if (zipImg?.blob) {
        try {
          const compressed = await compressImage(zipImg.blob)
          const preview = URL.createObjectURL(compressed)
          return { ...row, categoryId, imageBlob: compressed, imagePreview: preview, matched: true }
        } catch { /* skip bad image */ }
      }
      return { ...row, categoryId, matched: false }
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

    if (!wholesalerId) { errs.push('错误：wholesalerId 为空，请重新登录'); setErrors(errs); setResult({ ok: 0, skipped: total }); setStep('done'); return }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      setProgress(Math.round((i / total) * 100))
      setProgressMsg(`正在处理: ${row.name} (${i + 1}/${total})`)
      try {
        let imageUrl: string | undefined
        if (row.imageBlob) {
          try {
            const imgKey = barcodeKey(row.sku) || barcodeKey(row.barcode) || barcodeKey(row.name) || `p${Date.now()}`
          imageUrl = await store.uploadProductImage(wholesalerId, imgKey, row.imageBlob)
          } catch (e: any) { errs.push(`${row.name} 图片上传失败: ${e.message}`) }
        }
        // SKU(编号) is primary key; barcode(EAN) is secondary
        await store.addProduct(
          { name: row.name, categoryId: row.categoryId, price: row.price, unit: row.unit, boxQty: row.boxQty, subcategory: row.subcategory, stock: row.stock, barcode: row.barcode || undefined, description: row.description, image: imageUrl },
          wholesalerId,
          row.sku || undefined
        )
        ok++
      } catch (e: any) { errs.push(`${row.name}: ${e.message}`); skipped++ }
    }

    setProgress(100)
    setProgressMsg('验证中…')

    // Post-import verification: count actual rows in DB
    try {
      const { supabase } = await import('@/lib/supabase')
      const { count } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('wholesaler_id', wholesalerId)
      errs.push(`[诊断] 导入后DB实际商品数: ${count ?? '查询失败'} 条 (wholesalerId=${wholesalerId})`)
    } catch (e: any) { errs.push(`[诊断] 验证查询失败: ${e.message}`) }

    setProgressMsg('完成！')
    setErrors(errs)
    setResult({ ok, skipped })
    setStep('done')
  }

  // ── Image-only update: load images, match to existing products, upload ──
  async function loadImgOnly(e: React.ChangeEvent<HTMLInputElement>, isZip: boolean) {
    const file = e.target.files?.[0]; if (!file) return
    setParsing(true)
    try {
      let map: Map<string, ZipImage>
      if (isZip) {
        map = await extractZip(file)
      } else {
        map = new Map()
        Array.from(e.target.files || []).forEach(f => map.set(barcodeKey(f.name), { blob: f }))
      }
      setImgOnlyMap(prev => new Map([...prev, ...map]))
    } catch { /* ignore */ }
    setParsing(false)
    e.target.value = ''
  }

  async function loadImgOnlyMulti(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    const map = new Map<string, ZipImage>()
    files.forEach(f => map.set(barcodeKey(f.name), { blob: f }))
    setImgOnlyMap(prev => new Map([...prev, ...map]))
    e.target.value = ''
  }

  async function doImageOnlyUpdate() {
    if (imgOnlyMap.size === 0) return
    setImgOnlyRunning(true); setImgOnlyDone(null); setImgOnlyProgress(0)

    // fetch all products (sku + barcode → id map)
    setImgOnlyMsg('正在加载商品列表…')
    const { supabase } = await import('@/lib/supabase')
    const allProds: { id: string; sku: string | null; barcode: string | null }[] = []
    for (let off = 0; off < 10000; off += 1000) {
      const { data } = await supabase.from('products').select('id,sku,barcode').eq('wholesaler_id', wholesalerId).range(off, off + 999)
      if (!data || data.length === 0) break
      allProds.push(...data)
    }
    // Build lookup: sku → id (priority), then barcode → id (fallback)
    const keyToId = new Map<string, string>()
    for (const p of allProds) {
      if (p.barcode) keyToId.set(barcodeKey(p.barcode), p.id)
    }
    for (const p of allProds) {
      if (p.sku) keyToId.set(barcodeKey(p.sku), p.id) // sku overwrites barcode if same key
    }
    const barcodeToId = keyToId

    // Pre-build category map from folder names (auto-create if missing)
    setImgOnlyMsg('检查分类…')
    const localCats = [...categories]
    const folderNames = new Set([...imgOnlyMap.values()].map(zi => zi.category).filter(Boolean) as string[])
    for (const catName of folderNames) {
      if (!localCats.find(c => c.name === catName)) {
        const nc = await store.addCategory(catName, wholesalerId)
        localCats.push(nc)
      }
    }
    const catNameToId = new Map(localCats.map(c => [c.name, c.id]))

    let ok = 0, skipped = 0
    const unmatched: string[] = []
    const entries = [...imgOnlyMap.entries()]
    for (let i = 0; i < entries.length; i++) {
      const [key, zi] = entries[i]
      setImgOnlyProgress(Math.round((i / entries.length) * 100))
      setImgOnlyMsg(`处理 ${i + 1}/${entries.length}`)
      const prodId = barcodeToId.get(key)
      if (!prodId) { skipped++; unmatched.push(zi.category ? `${zi.category}/${key}` : key); continue }
      try {
        const compressed = await compressImage(zi.blob)
        const url = await store.uploadProductImage(wholesalerId, key, compressed)
        // update image + category (from folder name)
        const updates: Record<string, any> = { image: url }
        if (zi.category) {
          const catId = catNameToId.get(zi.category)
          if (catId) updates.categoryId = catId
        }
        await store.updateProduct(prodId, updates)
        ok++
      } catch { skipped++ }
    }

    setImgOnlyProgress(100)
    setImgOnlyMsg('完成')
    setImgOnlyDone({ ok, skipped, unmatched })
    setImgOnlyRunning(false)
  }

  function downloadUnmatchedList(unmatched: string[]) {
    const header = '文件名(含分类文件夹)\n'
    const csv = '﻿' + header + unmatched.join('\n') // BOM for Excel中文兼容
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = '未匹配图片清单.csv'; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const matchedCount = rows.filter(r => r.matched).length

  return (
    <div className="max-w-2xl">
      {/* ── Step: upload ── */}
      {step === 'upload' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <div className="text-sm font-medium text-gray-700 mb-3">① 下载模板 / 上传商品表（Excel）</div>
            <p className="text-xs text-gray-400 mb-3">第1列填编号，系统用编号匹配图片。无编号再用条码。</p>
            <div className="flex gap-3 flex-wrap">
              <button onClick={async () => { try { await exportProductTemplate(categories) } catch(e:any) { alert('下载失败:' + e.message) } }}
                className="px-4 py-2 border border-orange-400 text-orange-500 rounded-lg text-sm font-medium hover:bg-orange-50">
                📋 下载导入模板
              </button>
              <button onClick={() => excelRef.current?.click()} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">
                📤 选择 Excel 文件
              </button>
              {excelFile && <span className="text-sm text-green-600 flex items-center">✓ {excelFile.name}（{rows.length} 条商品）</span>}
            </div>
            <input ref={excelRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcel} />
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm">
            <div className="text-sm font-medium text-gray-700 mb-1">② 上传图片（按编号命名）</div>
            <p className="text-xs text-gray-400 mb-3">图片文件名 = 编号，如 <code className="bg-gray-100 px-1 rounded">001.jpg</code>。支持 ZIP 打包或多选图片。</p>
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
                  {[...imageMap.entries()].map(([key, zi]) => (
                    <div key={key} className="text-xs text-gray-500 font-mono">
                      {zi.category ? <span className="text-orange-500">{zi.category}/</span> : null}{key}
                    </div>
                  ))}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  橙色为文件夹名（自动当分类）· 文件名需和编号一致
                </div>
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
            <div className="flex gap-3">
              <button onClick={doMatch} disabled={parsing}
                className="flex-1 py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-60">
                {parsing ? '处理中…' : imageMap.size > 0 ? `导入数据 + 图片（${rows.length} 条）` : `仅导入数据（${rows.length} 条，无图片）`}
              </button>
            </div>
          )}

          {/* ── 独立图片更新区 ── */}
          <div className="bg-white rounded-xl p-5 shadow-sm border-2 border-dashed border-blue-100">
            <div className="text-sm font-semibold text-gray-700 mb-1">🖼️ 分批上传图片（自动分配分类）</div>
            <p className="text-xs text-gray-400 mb-3">先导入 Excel 数据，再分批上传图片。<strong>文件夹名 = 分类</strong>，文件名 = 编号。ZIP 文件夹自动创建分类并分配给商品。每批建议 150-200 张。</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <button onClick={() => zipOnlyRef.current?.click()} disabled={imgOnlyRunning}
                className="flex flex-col items-center gap-1.5 p-3 border border-blue-200 rounded-xl hover:bg-blue-50 transition-colors text-sm">
                <span className="text-xl">📦</span><span className="text-gray-600">ZIP 图片包</span>
              </button>
              <button onClick={() => imgOnlyRef.current?.click()} disabled={imgOnlyRunning}
                className="flex flex-col items-center gap-1.5 p-3 border border-blue-200 rounded-xl hover:bg-blue-50 transition-colors text-sm">
                <span className="text-xl">🖼️</span><span className="text-gray-600">多选图片</span>
              </button>
            </div>
            <input ref={zipOnlyRef} type="file" accept=".zip" className="hidden" onChange={e => loadImgOnly(e, true)} />
            <input ref={imgOnlyRef} type="file" accept="image/*" multiple className="hidden" onChange={loadImgOnlyMulti} />

            {imgOnlyMap.size > 0 && !imgOnlyDone && (
              <div className="mb-3">
                <div className="text-xs text-green-600 mb-2">✓ 已选 {imgOnlyMap.size} 张图片</div>
                {imgOnlyRunning ? (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">{imgOnlyMsg}</div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${imgOnlyProgress}%` }} />
                    </div>
                  </div>
                ) : (
                  <button onClick={doImageOnlyUpdate}
                    className="w-full py-2.5 bg-blue-500 text-white text-sm font-semibold rounded-xl hover:bg-blue-600">
                    开始更新图片
                  </button>
                )}
              </div>
            )}

            {imgOnlyDone && (
              <div className="bg-green-50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-green-800 font-medium">
                    ✅ 更新完成：{imgOnlyDone.ok} 张成功，{imgOnlyDone.skipped} 张未匹配
                  </span>
                  <button onClick={() => { setImgOnlyDone(null); setImgOnlyMap(new Map()) }}
                    className="text-xs text-blue-600 hover:underline shrink-0">
                    清空，准备下一批 →
                  </button>
                </div>

                {imgOnlyDone.unmatched.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-green-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-600 font-medium">未匹配到商品的图片（{imgOnlyDone.unmatched.length} 个）：</span>
                      <button onClick={() => downloadUnmatchedList(imgOnlyDone.unmatched)}
                        className="text-xs text-orange-600 hover:underline shrink-0">
                        📥 下载未匹配清单
                      </button>
                    </div>
                    <div className="bg-white rounded-lg p-2 max-h-32 overflow-y-auto">
                      {imgOnlyDone.unmatched.slice(0, 50).map((name, i) => (
                        <div key={i} className="text-xs text-gray-700 font-mono">{name}</div>
                      ))}
                      {imgOnlyDone.unmatched.length > 50 && (
                        <div className="text-xs text-gray-400 mt-1">…还有 {imgOnlyDone.unmatched.length - 50} 个，请下载清单查看完整列表</div>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-1.5">
                      可能原因：编号填写不一致、商品还未导入、或文件名打错字
                    </div>
                  </div>
                )}
              </div>
            )}
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
