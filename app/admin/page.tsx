'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { store, User, Product, Order, Category, getStatusLabel } from '@/lib/store'
import { exportAllOrders, exportSingleOrder, exportProductTemplate, importProductsFromFile } from '@/lib/excel'
import Navbar from '@/components/navbar'

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [tab, setTab] = useState<'orders' | 'products' | 'import' | 'categories'>('orders')
  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [showProductForm, setShowProductForm] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [form, setForm] = useState({ name: '', categoryId: '', price: '', unit: '件', stock: '', barcode: '', description: '', image: '' })
  const [imagePreview, setImagePreview] = useState('')
  const [newCatName, setNewCatName] = useState('')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ ok: number; errors: string[] } | null>(null)
  const [toast, setToast] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const importFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const u = store.getCurrentUser()
    if (!u || u.role !== 'admin') { router.replace('/login'); return }
    setUser(u)
    refreshData()
  }, [router])

  async function refreshData() {
    const [o, p, c] = await Promise.all([store.getOrders(), store.getProducts(), store.getCategories()])
    setOrders(o); setProducts(p); setCategories(c)
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  function openAddProduct() {
    setEditProduct(null)
    setForm({ name: '', categoryId: categories[0]?.id || 'c1', price: '', unit: '件', stock: '', barcode: '', description: '', image: '' })
    setImagePreview(''); setShowProductForm(true)
  }

  function openEditProduct(p: Product) {
    setEditProduct(p)
    setForm({ name: p.name, categoryId: p.categoryId, price: String(p.price), unit: p.unit, stock: String(p.stock), barcode: p.barcode || '', description: p.description || '', image: p.image || '' })
    setImagePreview(p.image || ''); setShowProductForm(true)
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { alert('图片不能超过 2MB'); return }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string
      setImagePreview(base64); setForm(f => ({ ...f, image: base64 }))
    }
    reader.readAsDataURL(file)
  }

  async function saveProduct() {
    if (!form.name || !form.price) return
    setSaving(true)
    const data = { name: form.name, categoryId: form.categoryId, price: parseFloat(form.price), unit: form.unit, stock: parseInt(form.stock) || 0, barcode: form.barcode, description: form.description, image: form.image }
    if (editProduct) await store.updateProduct(editProduct.id, data)
    else await store.addProduct(data)
    setSaving(false); setShowProductForm(false); refreshData()
  }

  async function deleteProduct(id: string) {
    if (!confirm('确认删除该商品？')) return
    await store.deleteProduct(id); refreshData()
  }

  async function updateOrderStatus(id: string, status: Order['status']) {
    await store.updateOrderStatus(id, status); refreshData()
  }

  async function addCategory() {
    if (!newCatName.trim()) return
    await store.addCategory(newCatName.trim()); setNewCatName(''); refreshData()
  }

  async function handleExportAll() {
    setExporting(true)
    try {
      await exportAllOrders(orders.filter(o => o.status !== 'pending_review'))
      showToast('导出成功！')
    } catch (e: any) { showToast('导出失败: ' + e.message) }
    setExporting(false)
  }

  async function handleExportSingle(order: Order) {
    setExporting(true)
    try {
      await exportSingleOrder(order, products)
      showToast('导出成功！')
    } catch (e: any) { showToast('导出失败: ' + e.message) }
    setExporting(false)
  }

  async function handleDownloadTemplate() {
    try { await exportProductTemplate(categories); showToast('模板已下载！') }
    catch (e: any) { showToast('失败: ' + e.message) }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setImporting(true); setImportResult(null)
    try {
      const { products: parsed, errors } = await importProductsFromFile(file, categories)
      let ok = 0, failed: string[] = []
      for (const p of parsed) {
        try { await store.addProduct(p); ok++ }
        catch (err: any) { failed.push(`${p.name}: ${err.message}`) }
      }
      setImportResult({ ok, errors: [...errors, ...failed] })
      if (ok > 0) await refreshData()
    } catch (e: any) { showToast('导入失败: ' + e.message) }
    setImporting(false)
    e.target.value = ''
  }

  const filteredProducts = products.filter(p => p.name.includes(search) || p.barcode?.includes(search))

  const statusActions: Record<Order['status'], { label: string; next: Order['status'] }[]> = {
    pending_review: [],
    pending: [{ label: '确认订单', next: 'confirmed' }, { label: '取消', next: 'cancelled' }],
    confirmed: [{ label: '标记发货', next: 'shipped' }],
    shipped: [{ label: '完成', next: 'completed' }],
    completed: [], cancelled: [],
  }
  const statusColor: Record<Order['status'], string> = {
    pending_review: 'bg-orange-100 text-orange-700',
    pending: 'bg-yellow-100 text-yellow-700', confirmed: 'bg-blue-100 text-blue-700',
    shipped: 'bg-purple-100 text-purple-700', completed: 'bg-green-100 text-green-700', cancelled: 'bg-gray-100 text-gray-500',
  }

  const stats = {
    totalOrders: orders.filter(o => o.status !== 'pending_review').length,
    pendingOrders: orders.filter(o => o.status === 'pending').length,
    todayRevenue: orders.filter(o => !['cancelled', 'pending_review'].includes(o.status) && o.createdAt.startsWith(new Date().toISOString().slice(0, 10))).reduce((s, o) => s + o.totalAmount, 0),
    totalProducts: products.length,
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} title="管理后台" />
      {toast && <div className="fixed top-16 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-sm px-4 py-2 rounded-full z-50 shadow">{toast}</div>}

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[{ label: '总订单', value: stats.totalOrders, color: 'text-blue-600' }, { label: '待处理', value: stats.pendingOrders, color: 'text-yellow-600' }, { label: '今日营收', value: `€${stats.todayRevenue.toFixed(2)}`, color: 'text-green-600' }, { label: '商品数', value: stats.totalProducts, color: 'text-purple-600' }].map(s => (
            <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-gray-400 text-sm mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mb-4 flex-wrap">
          {(['orders', 'products', 'import', 'categories'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
              {t === 'orders' ? '📋 订单管理' : t === 'products' ? '📦 商品管理' : t === 'import' ? '📥 批量导入' : '🏷️ 分类管理'}
            </button>
          ))}
        </div>

        {tab === 'orders' && (
          <div>
            <div className="flex justify-end mb-3">
              <button onClick={handleExportAll} disabled={exporting}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 disabled:opacity-60">
                {exporting ? '导出中…' : '📊 导出全部订单'}
              </button>
            </div>
            <div className="space-y-3">
              {orders.filter(o => o.status !== 'pending_review').length === 0 && <div className="text-center text-gray-400 py-12">暂无订单</div>}
              {orders.filter(o => o.status !== 'pending_review').map(order => (
                <div key={order.id} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div><span className="font-semibold text-gray-800">{order.orderNo}</span><span className="ml-2 text-sm text-gray-400">{order.buyerName}</span></div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[order.status]}`}>{getStatusLabel(order.status)}</span>
                  </div>
                  <div className="text-sm text-gray-500 mb-2">{order.items.map(i => `${i.productName}×${i.quantity}`).join('、')}</div>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2 flex-wrap">
                      {statusActions[order.status].map(a => (
                        <button key={a.next} onClick={() => updateOrderStatus(order.id, a.next)} className="text-xs px-3 py-1 bg-orange-500 text-white rounded-lg hover:bg-orange-600">{a.label}</button>
                      ))}
                      <button onClick={() => handleExportSingle(order)} disabled={exporting}
                        className="text-xs px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-60">
                        导出此单
                      </button>
                    </div>
                    <span className="font-bold text-orange-500">€{order.totalAmount.toFixed(2)}</span>
                  </div>
                  {order.remark && <div className="mt-2 text-xs text-gray-400 bg-gray-50 rounded p-2">备注：{order.remark}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'products' && (
          <div>
            <div className="flex gap-2 mb-4">
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索商品名或条形码…" className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
              <button onClick={openAddProduct} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">+ 添加商品</button>
            </div>
            <div className="space-y-2">
              {filteredProducts.map(p => {
                const cat = categories.find(c => c.id === p.categoryId)
                return (
                  <div key={p.id} className="bg-white rounded-xl p-3 shadow-sm flex items-center gap-3">
                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-orange-50 flex items-center justify-center shrink-0">
                      {p.image ? <img src={p.image} alt={p.name} className="w-full h-full object-cover" /> : <span className="text-2xl">📦</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-800 truncate">{p.name}</div>
                      <div className="text-sm text-gray-400">{cat?.name} · {p.unit} · 库存:{p.stock}</div>
                      {p.barcode && <div className="text-xs text-gray-300">条码:{p.barcode}</div>}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-bold text-orange-500">€{p.price.toFixed(2)}</span>
                      <button onClick={() => openEditProduct(p)} className="text-xs text-blue-500 hover:underline">编辑</button>
                      <button onClick={() => deleteProduct(p.id)} className="text-xs text-red-400 hover:underline">删除</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {tab === 'import' && (
          <div className="max-w-2xl">
            <div className="bg-white rounded-xl p-6 shadow-sm mb-4">
              <h3 className="font-bold text-gray-800 mb-1">批量导入商品</h3>
              <p className="text-sm text-gray-400 mb-5">先下载模板，填写商品信息，将图片插入到对应行的H列，然后上传。</p>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <button onClick={handleDownloadTemplate}
                  className="flex flex-col items-center gap-2 p-5 border-2 border-dashed border-gray-200 rounded-xl hover:border-orange-400 hover:bg-orange-50 transition-colors">
                  <span className="text-3xl">📋</span>
                  <span className="text-sm font-medium text-gray-700">下载导入模板</span>
                  <span className="text-xs text-gray-400">含使用说明和示例</span>
                </button>

                <button onClick={() => importFileRef.current?.click()} disabled={importing}
                  className="flex flex-col items-center gap-2 p-5 border-2 border-dashed border-blue-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors disabled:opacity-60">
                  <span className="text-3xl">{importing ? '⏳' : '📥'}</span>
                  <span className="text-sm font-medium text-gray-700">{importing ? '导入中…' : '上传并导入'}</span>
                  <span className="text-xs text-gray-400">支持 .xlsx / .xls</span>
                </button>
                <input ref={importFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportFile} />
              </div>

              {importResult && (
                <div className={`rounded-xl p-4 ${importResult.ok > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                  {importResult.ok > 0 && <div className="text-green-700 font-medium mb-2">✅ 成功导入 {importResult.ok} 个商品</div>}
                  {importResult.errors.length > 0 && (
                    <div>
                      <div className="text-red-600 font-medium mb-1">以下行有问题：</div>
                      {importResult.errors.map((e, i) => <div key={i} className="text-sm text-red-500">• {e}</div>)}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-orange-50 rounded-xl p-4 text-sm text-orange-700">
              <div className="font-medium mb-2">📌 图片导入说明</div>
              <ol className="list-decimal list-inside space-y-1 text-orange-600">
                <li>下载模板并用 Excel / WPS 打开</li>
                <li>填写商品信息（名称、分类、价格等）</li>
                <li>在每行 H 列：插入 → 图片 → 嵌入到单元格</li>
                <li>保存后上传文件即可批量导入</li>
              </ol>
            </div>
          </div>
        )}

        {tab === 'categories' && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex gap-2 mb-4">
              <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="新分类名称" className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
              <button onClick={addCategory} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">添加</button>
            </div>
            <div className="space-y-2">
              {categories.map(c => (
                <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-gray-700">{c.name}</span>
                  <span className="text-xs text-gray-300">{products.filter(p => p.categoryId === c.id).length} 个商品</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showProductForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-gray-800 mb-4">{editProduct ? '编辑商品' : '添加商品'}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-500 mb-1 block">商品图片</label>
                {imagePreview ? (
                  <div className="relative w-full h-40 rounded-xl overflow-hidden bg-gray-100">
                    <img src={imagePreview} alt="预览" className="w-full h-full object-cover" />
                    <button onClick={() => { setImagePreview(''); setForm(f => ({ ...f, image: '' })) }} className="absolute top-2 right-2 w-7 h-7 bg-black/50 text-white rounded-full flex items-center justify-center text-sm">✕</button>
                  </div>
                ) : (
                  <div onClick={() => fileInputRef.current?.click()} className="w-full h-32 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition-colors">
                    <span className="text-3xl mb-1">📷</span>
                    <span className="text-sm text-gray-400">点击上传图片</span>
                    <span className="text-xs text-gray-300">JPG / PNG，最大 2MB</span>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              </div>
              <div>
                <label className="text-sm text-gray-500 mb-1 block">商品名称 *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-500 mb-1 block">分类</label>
                  <select value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400">
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-500 mb-1 block">单位</label>
                  <input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-500 mb-1 block">价格 (€) *</label>
                  <input type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
                </div>
                <div>
                  <label className="text-sm text-gray-500 mb-1 block">库存</label>
                  <input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-500 mb-1 block">条形码</label>
                <input value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowProductForm(false)} className="flex-1 py-2 border border-gray-200 rounded-xl text-gray-600 text-sm hover:bg-gray-50">取消</button>
              <button onClick={saveProduct} disabled={saving} className="flex-1 py-2 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 disabled:opacity-60">
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
