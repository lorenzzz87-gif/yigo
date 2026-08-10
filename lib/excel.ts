import ExcelJS from 'exceljs'
import JSZip from 'jszip'
import { Order, Product, Category, BuyerProfile } from './store'

const STATUS_LABELS: Record<string, string> = {
  pending_review: '待业务员审核',
  pending: '待管理员确认',
  confirmed: '已确认',
  shipped: '已发货',
  completed: '已完成',
  cancelled: '已取消',
}

function base64ToUint8Array(base64: string): Uint8Array {
  const b64 = base64.includes(',') ? base64.split(',')[1] : base64
  const binary = atob(b64)
  const arr = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i)
  return arr
}

function styleHeader(row: ExcelJS.Row, color = 'FF374151') {
  row.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    }
  })
  row.height = 28
}

function styleCell(cell: ExcelJS.Cell, opts: { bold?: boolean; color?: string; fill?: string } = {}) {
  cell.alignment = { vertical: 'middle', wrapText: true }
  cell.border = {
    top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  }
  if (opts.bold) cell.font = { bold: true }
  if (opts.color) cell.font = { ...cell.font, color: { argb: opts.color } }
  if (opts.fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.fill } }
}

function downloadBuffer(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ─── Export: All Orders ────────────────────────────────────────────────────

export async function exportAllOrders(
  orders: Order[],
  opts?: { profiles?: Record<string, BuyerProfile | null>; skuById?: Record<string, string> },
) {
  const profiles = opts?.profiles || {}
  const skuById = opts?.skuById || {}
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Yigo管理端'
  wb.created = new Date()

  const ws = wb.addWorksheet('所有订单', { views: [{ state: 'frozen', ySplit: 2 }] })

  ws.mergeCells('A1:I1')
  const titleCell = ws.getCell('A1')
  titleCell.value = `Yigo订单汇总 — 导出时间：${new Date().toLocaleString('zh-CN')}`
  titleCell.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF97316' } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
  ws.getRow(1).height = 32

  ws.columns = [
    { key: 'no', width: 20 }, { key: 'buyer', width: 18 }, { key: 'phone', width: 16 },
    { key: 'piva', width: 16 }, { key: 'items', width: 46 }, { key: 'amount', width: 14 },
    { key: 'status', width: 14 }, { key: 'date', width: 20 }, { key: 'remark', width: 22 },
  ]

  const headerRow = ws.getRow(2)
  const headers = ['订单号', '客户 / Cliente', '电话 / Tel.', 'P.IVA', '商品明细（编号 名称 × 数量 金额）', '总金额(€)', '状态', '下单时间', '备注']
  headers.forEach((h, i) => { headerRow.getCell(i + 1).value = h })
  styleHeader(headerRow, 'FF374151')

  const statusColorMap: Record<string, string> = {
    pending_review: 'FFFFF7ED', pending: 'FFFEFCE8', confirmed: 'FFEFF6FF',
    shipped: 'FFFAF5FF', completed: 'FFF0FDF4', cancelled: 'FFF9FAFB',
  }

  orders.forEach((order, idx) => {
    const prof = profiles[order.buyerId]
    const row = ws.addRow({
      no: order.orderNo,
      buyer: prof?.ragioneSociale || order.buyerName,
      phone: prof?.telefono || '',
      piva: prof?.piva || '',
      items: order.items.map(i => {
        const sku = skuById[i.productId]
        return `${sku ? sku + ' ' : ''}${i.productName} × ${i.quantity}${i.unit}  €${(i.price * i.quantity).toFixed(2)}`
      }).join('\n'),
      amount: order.totalAmount,
      status: STATUS_LABELS[order.status] || order.status,
      date: new Date(order.createdAt).toLocaleString('zh-CN'),
      remark: order.remark || '',
    })

    const altFill = idx % 2 === 0 ? 'FFFFFFFF' : 'FFFAFAFA'
    row.eachCell((cell, colNum) => {
      styleCell(cell)
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colNum === 7 ? (statusColorMap[order.status] || 'FFFFFFFF') : altFill } }
    })

    const amountCell = row.getCell(6)
    amountCell.numFmt = '€#,##0.00'
    amountCell.font = { bold: true, color: { argb: 'FFF97316' } }
    row.height = Math.max(22, order.items.length * 16 + 6)
  })

  ws.addRow([])
  const sumRow = ws.addRow(['', '', '', '', `共 ${orders.length} 张订单`, { formula: `SUM(F3:F${orders.length + 2})` } as ExcelJS.CellFormulaValue, '', '', ''])
  sumRow.getCell(5).font = { bold: true }
  sumRow.getCell(6).numFmt = '€#,##0.00'
  sumRow.getCell(6).font = { bold: true, color: { argb: 'FFF97316' } }

  const buffer = await wb.xlsx.writeBuffer()
  const date = new Date().toISOString().slice(0, 10)
  downloadBuffer(buffer, `Yigo订单汇总_${date}.xlsx`)
}

// ─── Export: Single Order ──────────────────────────────────────────────────

export async function exportSingleOrder(order: Order, products: Product[], profile?: BuyerProfile | null) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Yigo管理端'

  const ws = wb.addWorksheet('订单详情')
  ws.columns = [
    { width: 14 }, { width: 14 }, { width: 28 }, { width: 12 }, { width: 9 }, { width: 14 }, { width: 10 },
  ]

  ws.mergeCells('A1:G1')
  const t = ws.getCell('A1')
  t.value = 'Yigo 易购 · 订单 / Ordine'
  t.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } }
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF97316' } }
  t.alignment = { vertical: 'middle', horizontal: 'center' }
  ws.getRow(1).height = 40

  const info: [string, string, string, string][] = [
    ['订单号', order.orderNo, '状态', STATUS_LABELS[order.status] || order.status],
    ['客户名', order.buyerName, '下单时间', new Date(order.createdAt).toLocaleString('zh-CN')],
  ]
  info.forEach(([l1, v1, l2, v2]) => {
    const row = ws.addRow([l1, v1, '', '', l2, v2, ''])
    row.getCell(1).font = { bold: true, color: { argb: 'FF6B7280' } }
    row.getCell(5).font = { bold: true, color: { argb: 'FF6B7280' } }
    row.height = 22
    ws.mergeCells(`B${row.number}:D${row.number}`)
    ws.mergeCells(`F${row.number}:G${row.number}`)
  })

  // 客户信息 / Cliente（来自 Profilo）
  if (profile) {
    const billAddr = [profile.indirizzoFattura, profile.capFattura, profile.cittaFattura, profile.provinciaFattura].filter(Boolean).join(' ')
    const shipAddr = [profile.indirizzoSpedizione, profile.capSpedizione, profile.cittaSpedizione].filter(Boolean).join(' ')
    const custRows = ([
      ['公司 / Ragione Sociale', profile.ragioneSociale || ''],
      ['P.IVA', profile.piva || ''],
      ['税号 / Cod. Fiscale', profile.codiceFiscale || ''],
      ['电话 / Telefono', profile.telefono || ''],
      ['Email', profile.emailOrdini || ''],
      ['Codice SDI', profile.codiceSdi || ''],
      ['PEC', profile.pec || ''],
      ['开票地址 / Indirizzo', billAddr],
      ['收货地址 / Spedizione', shipAddr],
      ['收货备注 / Note', profile.noteConsegna || ''],
    ] as [string, string][]).filter(([, v]) => (v || '').trim())
    if (custRows.length) {
      const cTitle = ws.addRow(['客户信息 / Cliente'])
      cTitle.getCell(1).font = { bold: true, color: { argb: 'FFF97316' } }
      custRows.forEach(([l, v]) => {
        const row = ws.addRow([l, v, '', '', '', '', ''])
        row.getCell(1).font = { bold: true, color: { argb: 'FF6B7280' } }
        row.height = 20
        ws.mergeCells(`B${row.number}:G${row.number}`)
      })
    }
  }

  if (order.remark) {
    const row = ws.addRow(['备注 / Note', order.remark, '', '', '', '', ''])
    row.getCell(1).font = { bold: true, color: { argb: 'FF6B7280' } }
    ws.mergeCells(`B${row.number}:G${row.number}`)
  }

  ws.addRow([])

  const itemHeader = ws.addRow(['商品图片', '编号 / Cod.', '商品名称', '单价(€)', '数量', '小计(€)', '单位'])
  styleHeader(itemHeader, 'FF374151')
  ws.getRow(itemHeader.number).height = 28

  for (let i = 0; i < order.items.length; i++) {
    const item = order.items[i]
    const product = products.find(p => p.id === item.productId)
    const rowIdx = itemHeader.number + 1 + i
    const row = ws.addRow(['', product?.sku || '', item.productName, item.price, item.quantity, item.price * item.quantity, item.unit])
    row.height = 60

    row.getCell(4).numFmt = '€#,##0.00'
    row.getCell(6).numFmt = '€#,##0.00'
    row.getCell(6).font = { bold: true, color: { argb: 'FFF97316' } }
    row.eachCell(cell => {
      styleCell(cell)
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    })

    if (product?.image) {
      try {
        const ext = product.image.startsWith('data:image/png') ? 'png' : 'jpeg'
        const imgData = base64ToUint8Array(product.image)
        const imageId = wb.addImage({ buffer: imgData as any, extension: ext })
        ws.addImage(imageId, { tl: { col: 0, row: rowIdx - 1 } as any, br: { col: 1, row: rowIdx } as any, editAs: 'oneCell' })
      } catch { /* skip */ }
    }
  }

  ws.addRow([])
  const totalRow = ws.addRow(['', '', '', '合计', '', { formula: `SUM(F${itemHeader.number + 1}:F${itemHeader.number + order.items.length})` } as ExcelJS.CellFormulaValue, ''])
  ws.mergeCells(`A${totalRow.number}:D${totalRow.number}`)
  totalRow.getCell(4).font = { bold: true }
  totalRow.getCell(6).numFmt = '€#,##0.00'
  totalRow.getCell(6).font = { bold: true, size: 13, color: { argb: 'FFF97316' } }
  totalRow.height = 28

  const buffer = await wb.xlsx.writeBuffer()
  downloadBuffer(buffer, `订单_${order.orderNo}.xlsx`)
}

// ─── Export: Product Import Template ──────────────────────────────────────

export async function exportProductTemplate(_categories: Category[]) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('商品导入', { views: [{ state: 'frozen', ySplit: 2 }] })

  // 列顺序：A编号 B条形码 C中文名 D西文名 E分类 F子分类 G包装数 H装箱数 I售价 J IVA K库存
  ws.columns = [
    { key: 'sku',         width: 12 },
    { key: 'barcode',     width: 16 },
    { key: 'name',        width: 24 },
    { key: 'nameIt',      width: 28 },
    { key: 'category',    width: 22 },
    { key: 'subcategory', width: 20 },
    { key: 'unit',        width: 10 },
    { key: 'boxQty',      width: 10 },
    { key: 'price',       width: 12 },
    { key: 'iva',         width: 8  },
    { key: 'stock',       width: 10 },
  ]

  ws.mergeCells('A1:K1')
  const t = ws.getCell('A1')
  t.value = 'Yigo 商品导入模板  A编号 · B条形码 · C中文名 · D西文名 · E分类 · F子分类 · G包装数 · H装箱数 · I售价 · J IVA · K库存'
  t.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF97316' } }
  t.alignment = { vertical: 'middle', horizontal: 'center' }
  ws.getRow(1).height = 28

  const hr = ws.addRow(['编号', '条形码*', '中文品名*', '西文名', '分类（可选）', '子分类（可选）', '包装数*', '装箱数', '售价(€)*', 'IVA%', '库存'])
  styleHeader(hr, 'FF374151')

  ;[
    ['001', '6901028001', '可口可乐 330ml', 'Coca-Cola 330ml', '饮料', '碳酸饮料', '24罐', 24, 0.55, 22, 500],
    ['002', '6901028002', '矿泉水 500ml',   'Acqua 500ml',     '饮料', '矿泉水',   '12瓶', 12, 0.30,  4, 800],
  ].forEach(s => {
    const row = ws.addRow(s)
    row.getCell(9).numFmt = '€0.00'
    row.getCell(10).numFmt = '0"%"'
    row.height = 22
    row.eachCell(cell => styleCell(cell))
  })

  // 说明 sheet
  const infoWs = wb.addWorksheet('使用说明')
  const infoRows = [
    ['Yigo 商品导入说明'],
    [''],
    ['Excel 列说明（共11列）:'],
    ['A - 编号（内部货号，选填；图片文件名需与编号一致，如 001.jpg）'],
    ['B - 条形码（选填）'],
    ['C - 中文品名（必填）'],
    ['D - 西文品名（意大利语，B2B端显示，选填）'],
    ['E - 分类（选填）：直接写分类名如"800 Unipart"，不存在则自动创建'],
    ['  ※ ZIP文件夹分类优先级高于E列；两者都有时以ZIP为准'],
    ['F - 子分类（选填）：同分类下的细分，如"S系列"、"LED大灯"等'],
    ['G - 包装数/单位，如 24罐、12瓶/箱（必填）'],
    ['H - 装箱数（每箱件数，选填）'],
    ['I - 售价，单位欧元（必填）'],
    ['J - IVA税率，如 22 或 4（不含%号，选填）'],
    ['K - 库存数量（选填）'],
    [''],
    ['图片 ZIP 说明:'],
    ['• 用文件夹名作为分类，如：饮料/001.jpg（优先于E列）'],
    ['• 不在文件夹里的图片：分类由E列决定'],
    ['• 已有分类直接用；新分类名自动创建'],
    ['• 支持 jpg / png / webp 格式'],
  ]
  infoRows.forEach((r, i) => {
    const row = infoWs.addRow(r)
    if (i === 0) row.getCell(1).font = { bold: true, size: 13, color: { argb: 'FFF97316' } }
    if (i === 2 || i === 13) row.getCell(1).font = { bold: true }
  })
  infoWs.getColumn(1).width = 50

  const buffer = await wb.xlsx.writeBuffer()
  downloadBuffer(buffer, 'Yigo商品导入模板.xlsx')
}

// ─── Import: Products from Excel ──────────────────────────────────────────

export async function importProductsFromFile(file: File, categories: Category[]): Promise<{ products: Omit<Product, 'id'>[]; errors: string[] }> {
  const buffer = await file.arrayBuffer()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)

  const ws = wb.getWorksheet('商品导入') || wb.worksheets[0]
  const results: Omit<Product, 'id'>[] = []
  const errors: string[] = []

  // Extract images: supports both traditional drawings AND WPS/Excel365 cellImages (DISPIMG)
  const imagesByRow: Record<number, string> = {}

  function uint8ToBase64(bytes: Uint8Array): string {
    let binary = ''
    const chunk = 8192
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
    }
    return btoa(binary)
  }

  // Method 1: traditional exceljs drawing images
  ;(ws.getImages?.() || []).forEach((img: any) => {
    const rowNum1indexed = Math.floor(img.range.tl.row) + 1
    const imgData = (wb as any).getImage(img.imageId)
    if (imgData?.buffer) {
      try {
        const b64 = uint8ToBase64(new Uint8Array(imgData.buffer))
        imagesByRow[rowNum1indexed] = `data:image/${imgData.extension || 'jpeg'};base64,${b64}`
      } catch { /* skip */ }
    }
  })

  // Method 2: WPS/Excel365 cellImages (DISPIMG formula) — parse zip directly
  try {
    const zip = await JSZip.loadAsync(buffer)

    // rId → media path
    const rIdToMedia: Record<string, string> = {}
    const relsFile = zip.file('xl/_rels/cellimages.xml.rels')
    if (relsFile) {
      const relsXml = await relsFile.async('text')
      for (const m of relsXml.matchAll(/Id="([^"]+)"[^>]+Target="([^"]+)"/g)) {
        rIdToMedia[m[1]] = m[2]
      }
    }

    // imageId name → rId
    const nameToRId: Record<string, string> = {}
    const cellImgFile = zip.file('xl/cellimages.xml')
    if (cellImgFile) {
      const cellImgXml = await cellImgFile.async('text')
      for (const block of cellImgXml.matchAll(/<etc:cellImage>([\s\S]*?)<\/etc:cellImage>/g)) {
        const nameMatch = block[1].match(/name="([^"]+)"/)
        const embedMatch = block[1].match(/r:embed="([^"]+)"/)
        if (nameMatch && embedMatch) nameToRId[nameMatch[1]] = embedMatch[1]
      }
    }

    // sheet row → imageId via DISPIMG formula
    const sheetFile = zip.file('xl/worksheets/sheet1.xml') || zip.file('xl/worksheets/sheet2.xml')
    if (sheetFile && Object.keys(nameToRId).length > 0) {
      const sheetXml = await sheetFile.async('text')
      // match: <c r="H3" ...>...<f>..DISPIMG(&quot;ID_xxx&quot;...)
      for (const m of sheetXml.matchAll(/<c r="[A-Z]+(\d+)"[^>]*>[\s\S]*?DISPIMG\([^"]*(?:&quot;|")([^&"]+)(?:&quot;|")/g)) {
        const rowNum = parseInt(m[1])
        const imgId = m[2]
        const rId = nameToRId[imgId]
        if (!rId) continue
        const mediaPath = rIdToMedia[rId]
        if (!mediaPath) continue
        const mediaFile = zip.file('xl/' + mediaPath)
        if (!mediaFile) continue
        const bytes = await mediaFile.async('uint8array')
        const ext = mediaPath.endsWith('.png') ? 'png' : 'jpeg'
        imagesByRow[rowNum] = `data:image/${ext};base64,${uint8ToBase64(bytes)}`
      }
    }
  } catch { /* fallback gracefully */ }

  ws.eachRow((row, rowNum) => {
    if (rowNum <= 2) return
    const name = (row.getCell(1).text || '').trim()
    const categoryRaw = (row.getCell(2).text || '').trim()
    const priceRaw = row.getCell(3).value
    const unit = (row.getCell(4).text || '').trim()
    const stockRaw = row.getCell(5).value
    const barcode = (row.getCell(6).text || '').trim()
    const description = (row.getCell(7).text || '').trim()
    const image = imagesByRow[rowNum] || undefined

    if (!name) return
    if (!categoryRaw) { errors.push(`第${rowNum}行 "${name}"：缺少分类`); return }
    if (!priceRaw) { errors.push(`第${rowNum}行 "${name}"：缺少价格`); return }
    if (!unit) { errors.push(`第${rowNum}行 "${name}"：缺少单位`); return }

    const cat = categories.find(c => c.name === categoryRaw)
    if (!cat) { errors.push(`第${rowNum}行 "${name}"：找不到分类"${categoryRaw}"，请参考分类参考Sheet`); return }

    results.push({
      name, categoryId: cat.id, price: Number(priceRaw), unit,
      stock: Number(stockRaw) || 0,
      barcode: barcode || undefined,
      description: description || undefined,
      image,
    })
  })

  return { products: results, errors }
}
