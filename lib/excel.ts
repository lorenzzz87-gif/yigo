import ExcelJS from 'exceljs'
import { Order, Product, Category } from './store'

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

export async function exportAllOrders(orders: Order[]) {
  const wb = new ExcelJS.Workbook()
  wb.creator = '友购管理端'
  wb.created = new Date()

  const ws = wb.addWorksheet('所有订单', { views: [{ state: 'frozen', ySplit: 2 }] })

  ws.mergeCells('A1:I1')
  const titleCell = ws.getCell('A1')
  titleCell.value = `友购订单汇总 — 导出时间：${new Date().toLocaleString('zh-CN')}`
  titleCell.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF97316' } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
  ws.getRow(1).height = 32

  ws.columns = [
    { key: 'no', width: 20 }, { key: 'buyer', width: 14 }, { key: 'phone', width: 16 },
    { key: 'items', width: 38 }, { key: 'amount', width: 14 }, { key: 'status', width: 16 },
    { key: 'sales', width: 12 }, { key: 'date', width: 20 }, { key: 'remark', width: 22 },
  ]

  const headerRow = ws.getRow(2)
  const headers = ['订单号', '客户名', '联系方式', '商品明细', '总金额(€)', '状态', '业务员', '下单时间', '备注']
  headers.forEach((h, i) => { headerRow.getCell(i + 1).value = h })
  styleHeader(headerRow, 'FF374151')

  const statusColorMap: Record<string, string> = {
    pending_review: 'FFFFF7ED', pending: 'FFFEFCE8', confirmed: 'FFEFF6FF',
    shipped: 'FFFAF5FF', completed: 'FFF0FDF4', cancelled: 'FFF9FAFB',
  }

  orders.forEach((order, idx) => {
    const row = ws.addRow({
      no: order.orderNo, buyer: order.buyerName, phone: '',
      items: order.items.map(i => `${i.productName} × ${i.quantity}${i.unit}  €${(i.price * i.quantity).toFixed(2)}`).join('\n'),
      amount: order.totalAmount,
      status: STATUS_LABELS[order.status] || order.status,
      sales: order.salesId || '',
      date: new Date(order.createdAt).toLocaleString('zh-CN'),
      remark: order.remark || '',
    })

    const altFill = idx % 2 === 0 ? 'FFFFFFFF' : 'FFFAFAFA'
    row.eachCell((cell, colNum) => {
      styleCell(cell)
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colNum === 6 ? (statusColorMap[order.status] || 'FFFFFFFF') : altFill } }
    })

    const amountCell = row.getCell(5)
    amountCell.numFmt = '€#,##0.00'
    amountCell.font = { bold: true, color: { argb: 'FFF97316' } }
    row.height = Math.max(22, order.items.length * 16 + 6)
  })

  ws.addRow([])
  const sumRow = ws.addRow(['', '', '', `共 ${orders.length} 张订单`, { formula: `SUM(E3:E${orders.length + 2})` } as ExcelJS.CellFormulaValue, '', '', '', ''])
  sumRow.getCell(4).font = { bold: true }
  sumRow.getCell(5).numFmt = '€#,##0.00'
  sumRow.getCell(5).font = { bold: true, color: { argb: 'FFF97316' } }

  const buffer = await wb.xlsx.writeBuffer()
  const date = new Date().toISOString().slice(0, 10)
  downloadBuffer(buffer, `友购订单汇总_${date}.xlsx`)
}

// ─── Export: Single Order ──────────────────────────────────────────────────

export async function exportSingleOrder(order: Order, products: Product[]) {
  const wb = new ExcelJS.Workbook()
  wb.creator = '友购管理端'

  const ws = wb.addWorksheet('订单详情')
  ws.columns = [
    { width: 14 }, { width: 28 }, { width: 14 }, { width: 10 }, { width: 14 }, { width: 16 },
  ]

  ws.mergeCells('A1:F1')
  const t = ws.getCell('A1')
  t.value = '友 购 订 单'
  t.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } }
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF97316' } }
  t.alignment = { vertical: 'middle', horizontal: 'center' }
  ws.getRow(1).height = 40

  const info: [string, string, string, string][] = [
    ['订单号', order.orderNo, '状态', STATUS_LABELS[order.status] || order.status],
    ['客户名', order.buyerName, '下单时间', new Date(order.createdAt).toLocaleString('zh-CN')],
    ['备注', order.remark || '—', '', ''],
  ]
  info.forEach(([l1, v1, l2, v2]) => {
    const row = ws.addRow([l1, v1, '', l2, v2, ''])
    row.getCell(1).font = { bold: true, color: { argb: 'FF6B7280' } }
    row.getCell(4).font = { bold: true, color: { argb: 'FF6B7280' } }
    row.height = 22
    if (!l2) ws.mergeCells(`B${row.number}:F${row.number}`)
    else ws.mergeCells(`B${row.number}:C${row.number}`)
  })

  ws.addRow([])

  const itemHeader = ws.addRow(['商品图片', '商品名称', '单价(€)', '数量', '小计(€)', '单位'])
  styleHeader(itemHeader, 'FF374151')
  ws.getRow(itemHeader.number).height = 28

  for (let i = 0; i < order.items.length; i++) {
    const item = order.items[i]
    const product = products.find(p => p.id === item.productId)
    const rowIdx = itemHeader.number + 1 + i
    const row = ws.addRow(['', item.productName, item.price, item.quantity, item.price * item.quantity, item.unit])
    row.height = 60

    row.getCell(3).numFmt = '€#,##0.00'
    row.getCell(5).numFmt = '€#,##0.00'
    row.getCell(5).font = { bold: true, color: { argb: 'FFF97316' } }
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
  const totalRow = ws.addRow(['', '', '', '合计', { formula: `SUM(E${itemHeader.number + 1}:E${itemHeader.number + order.items.length})` } as ExcelJS.CellFormulaValue, ''])
  ws.mergeCells(`A${totalRow.number}:C${totalRow.number}`)
  totalRow.getCell(4).font = { bold: true }
  totalRow.getCell(5).numFmt = '€#,##0.00'
  totalRow.getCell(5).font = { bold: true, size: 13, color: { argb: 'FFF97316' } }
  totalRow.height = 28

  const buffer = await wb.xlsx.writeBuffer()
  downloadBuffer(buffer, `订单_${order.orderNo}.xlsx`)
}

// ─── Export: Product Import Template ──────────────────────────────────────

export async function exportProductTemplate(categories: Category[]) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('商品导入', { views: [{ state: 'frozen', ySplit: 2 }] })

  ws.columns = [
    { key: 'name', width: 24 }, { key: 'category', width: 16 },
    { key: 'price', width: 12 }, { key: 'unit', width: 10 },
    { key: 'stock', width: 10 }, { key: 'barcode', width: 18 },
    { key: 'desc', width: 28 }, { key: 'image', width: 20 },
  ]

  ws.mergeCells('A1:H1')
  const t = ws.getCell('A1')
  t.value = '友购商品批量导入模板 — 请勿修改第1、2行格式；图片请直接插入到对应行的H列单元格'
  t.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF97316' } }
  t.alignment = { vertical: 'middle', horizontal: 'center' }
  ws.getRow(1).height = 28

  const hr = ws.addRow(['商品名称*', '分类*', '价格*', '单位*', '库存', '条形码', '描述', '图片(插入图片到此列)'])
  styleHeader(hr, 'FF374151')

  const catName = categories[0]?.name || '饮料'
  ;[
    ['可乐 330ml', catName, 1.5, '瓶', 100, '6901028001', '经典口味', ''],
    ['矿泉水 500ml', catName, 0.8, '瓶', 200, '6901028002', '天然矿泉水', ''],
  ].forEach(s => {
    const row = ws.addRow(s)
    row.getCell(3).numFmt = '0.00'
    row.height = 60
    row.eachCell(cell => styleCell(cell))
  })

  const catWs = wb.addWorksheet('分类参考')
  catWs.addRow(['分类名称'])
  styleHeader(catWs.getRow(1), 'FF374151')
  categories.forEach(c => catWs.addRow([c.name]))

  const buffer = await wb.xlsx.writeBuffer()
  downloadBuffer(buffer, '友购商品导入模板.xlsx')
}

// ─── Import: Products from Excel ──────────────────────────────────────────

export async function importProductsFromFile(file: File, categories: Category[]): Promise<{ products: Omit<Product, 'id'>[]; errors: string[] }> {
  const buffer = await file.arrayBuffer()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)

  const ws = wb.getWorksheet('商品导入') || wb.worksheets[0]
  const results: Omit<Product, 'id'>[] = []
  const errors: string[] = []

  const imagesByRow: Record<number, string> = {}
  ;(ws.getImages?.() || []).forEach((img: any) => {
    const row = Math.floor(img.range.tl.row)
    const imgData = (wb as any).getImage(img.imageId)
    if (imgData) {
      const b64 = btoa(String.fromCharCode(...new Uint8Array(imgData.buffer)))
      const ext = imgData.extension || 'jpeg'
      imagesByRow[row] = `data:image/${ext};base64,${b64}`
    }
  })

  ws.eachRow((row, rowNum) => {
    if (rowNum <= 2) return
    const name = (row.getCell(1).text || '').trim()
    const categoryRaw = (row.getCell(2).text || '').trim()
    const priceRaw = row.getCell(3).value
    const unit = (row.getCell(4).text || '').trim()
    const stockRaw = row.getCell(5).value
    const barcode = (row.getCell(6).text || '').trim()
    const description = (row.getCell(7).text || '').trim()
    const image = imagesByRow[rowNum - 1] || undefined

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
