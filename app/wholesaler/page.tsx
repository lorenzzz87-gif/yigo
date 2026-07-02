'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  ClipboardList,
  Package,
  FileUp,
  Ticket,
  Tags,
  FileSpreadsheet,
  Trash2,
  Camera,
  Copy,
  PlayCircle,
  Plus,
  X,
  CheckCircle2,
} from 'lucide-react'
import { store, User, Product, Order, Category, Invite, getStatusLabel } from '@/lib/store'
import { exportAllOrders, exportSingleOrder } from '@/lib/excel'
import BulkImport from './BulkImport'
import Navbar from '@/components/navbar'

export default function WholesalerPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [wid, setWid] = useState<string>('')
  const [tab, setTab] = useState<'orders' | 'products' | 'import' | 'invites' | 'categories'>('orders')
  const [invites, setInvites] = useState<Invite[]>([])
  const [newInvite, setNewInvite] = useState<Invite | null>(null)
  const [generating, setGenerating] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [productTotal, setProductTotal] = useState(0)
  const [productPage, setProductPage] = useState(0)
  const [activeCategoryId, setActiveCategoryId] = useState<string | undefined>()
  const PRODUCT_PAGE_SIZE = 50
  const [categories, setCategories] = useState<Category[]>([])
  const [showProductForm, setShowProductForm] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [form, setForm] = useState({ name: '', categoryId: '', price: '', unit: '件', stock: '', barcode: '', description: '', image: '', videoUrl: '' })
  const [imagePreview, setImagePreview] = useState('')
  const [extraImages, setExtraImages] = useState<string[]>([])       // existing extra URLs
  const [newExtraFiles, setNewExtraFiles] = useState<File[]>([])      // new files to upload
  const extraImgRef = useRef<HTMLInputElement>(null)
  const [newCatName, setNewCatName] = useState('')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [toast, setToast] = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const u = store.getCurrentUser()
    if (!u || u.role !== 'wholesaler') { router.replace('/login'); return }
    if (!u.wholesalerId) { router.replace('/login'); return }
    setUser(u); setWid(u.wholesalerId)
    refreshData(u.wholesalerId)
    store.getWholesalerLogo(u.wholesalerId).then(url => { if (url) setLogoUrl(url) })
  }, [router])

  async function refreshData(w: string) {
    const [o, c, inv] = await Promise.all([store.getOrders(w), store.getCategories(w), store.getInvites(w)])
    setOrders(o); setCategories(c); setInvites(inv)
    loadProducts(w, search, 0)
  }

  async function loadProducts(w: string, q: string, page: number, catId?: string) {
    const [prods, total] = await Promise.all([
      store.getProducts(w, q || undefined, PRODUCT_PAGE_SIZE, page * PRODUCT_PAGE_SIZE, catId),
      store.countProducts(w, catId),
    ])
    setProducts(prods); setProductTotal(total); setProductPage(page)
    setActiveCategoryId(catId)
  }

  async function loadProductsByCategory(catId: string) {
    setSearch('')
    await loadProducts(wid, '', 0, catId)
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  async function handleLogoUpload(file: File) {
    setUploadingLogo(true)
    try {
      const url = await store.uploadWholesalerLogo(wid, file)
      setLogoUrl(url + '?t=' + Date.now())
      showToast('Logo 上传成功！')
    } catch (e: any) { showToast('上传失败: ' + e.message) }
    setUploadingLogo(false)
  }

  async function generateInvite() {
    setGenerating(true)
    const inv = await store.createInvite(wid)
    setNewInvite(inv)
    await refreshData(wid)
    setGenerating(false)
  }

  function inviteStatus(inv: Invite): { label: string; color: string } {
    if (inv.used) return { label: '已使用', color: 'bg-gray-100 text-gray-500' }
    if (new Date(inv.expiresAt).getTime() < Date.now()) return { label: '已过期', color: 'bg-red-100 text-red-600' }
    return { label: '有效', color: 'bg-green-100 text-green-700' }
  }

  function openAddProduct() {
    setEditProduct(null)
    setForm({ name: '', categoryId: categories[0]?.id || '', price: '', unit: '件', stock: '', barcode: '', description: '', image: '', videoUrl: '' })
    setImagePreview(''); setExtraImages([]); setNewExtraFiles([]); setShowProductForm(true)
  }

  function openEditProduct(p: Product) {
    setEditProduct(p)
    setForm({ name: p.name, categoryId: p.categoryId, price: String(p.price), unit: p.unit, stock: String(p.stock), barcode: p.barcode || '', description: p.description || '', image: p.image || '', videoUrl: p.videoUrl || '' })
    setImagePreview(p.image || ''); setExtraImages(p.images || []); setNewExtraFiles([]); setShowProductForm(true)
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
    // Upload any new extra image files
    const imgKey = form.barcode || form.name.slice(0, 20).replace(/\s+/g, '_')
    const uploadedExtras: string[] = []
    for (let i = 0; i < newExtraFiles.length; i++) {
      try {
        const { compressImage } = await import('@/lib/imageUtils')
        const compressed = await compressImage(newExtraFiles[i])
        const url = await store.uploadProductImage(wid, `${imgKey}_${extraImages.length + i + 2}`, compressed)
        uploadedExtras.push(url)
      } catch { /* skip failed */ }
    }
    const allExtras = [...extraImages, ...uploadedExtras]
    const data = { name: form.name, categoryId: form.categoryId, price: parseFloat(form.price), unit: form.unit, stock: parseInt(form.stock) || 0, barcode: form.barcode, description: form.description, image: form.image, images: allExtras.length ? allExtras : undefined, videoUrl: form.videoUrl || undefined }
    if (editProduct) await store.updateProduct(editProduct.id, data)
    else await store.addProduct(data, wid)
    setSaving(false); setShowProductForm(false); refreshData(wid)
  }

  async function deleteProduct(id: string) {
    if (!confirm('确认删除该商品？')) return
    await store.deleteProduct(id); refreshData(wid)
  }

  async function updateOrderStatus(id: string, status: Order['status']) {
    await store.updateOrderStatus(id, status); refreshData(wid)
  }

  async function addCategory() {
    if (!newCatName.trim()) return
    await store.addCategory(newCatName.trim(), wid); setNewCatName(''); refreshData(wid)
  }

  async function clearAllData() {
    if (!confirm('确认清除所有商品、分类和图片？此操作不可恢复！')) return
    setClearing(true)
    try {
      await store.clearAllWholesalerData(wid)
      showToast('已清除所有数据')
      refreshData(wid)
    } catch (e: any) { showToast('清除失败: ' + e.message) }
    setClearing(false)
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

  const filteredProducts = products // server-side filtered now

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
      <Navbar user={user} title={uploadingLogo ? '上传中…' : '批发商工作台'}
        logoUrl={logoUrl || undefined}
        onLogoUpload={handleLogoUpload} />
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-sm px-4 py-2 rounded-full z-50 shadow flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-400" strokeWidth={1.75} />
          {toast}
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[{ label: '总订单', value: stats.totalOrders, color: 'text-blue-600' }, { label: '待确认', value: stats.pendingOrders, color: 'text-yellow-600' }, { label: '今日营收', value: `€${stats.todayRevenue.toFixed(2)}`, color: 'text-green-600' }, { label: '商品数', value: productTotal, color: 'text-purple-600' }].map(s => (
            <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-gray-600 text-sm mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mb-4 flex-wrap">
          {([
            ['orders', '订单管理', ClipboardList],
            ['products', '商品管理', Package],
            ['import', '批量导入', FileUp],
            ['invites', '客户邀请', Ticket],
            ['categories', '分类管理', Tags],
          ] as const).map(([t, label, Icon]) => (
            <button key={t} onClick={() => setTab(t)} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
              <Icon className="w-4 h-4" strokeWidth={1.75} />
              {label}
            </button>
          ))}
        </div>

        {tab === 'orders' && (
          <div>
            <div className="flex justify-end mb-3">
              <button onClick={handleExportAll} disabled={exporting}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 disabled:opacity-60">
                <FileSpreadsheet className="w-4 h-4" strokeWidth={1.75} />
                {exporting ? '导出中…' : '导出全部订单'}
              </button>
            </div>
            <div className="space-y-3">
              {orders.filter(o => o.status !== 'pending_review').length === 0 && <div className="text-center text-gray-500 py-12">暂无订单</div>}
              {orders.filter(o => o.status !== 'pending_review').map(order => (
                <div key={order.id} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div><span className="font-semibold text-gray-800">{order.orderNo}</span><span className="ml-2 text-sm text-gray-600">{order.buyerName}</span></div>
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
            <div className="flex gap-2 mb-3">
              <input value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { setActiveCategoryId(undefined); loadProducts(wid, search, 0) } }}
                placeholder="搜索商品名或条形码，回车确认…"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
              <button onClick={() => { setActiveCategoryId(undefined); loadProducts(wid, search, 0) }} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">搜索</button>
              <button onClick={openAddProduct} className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors">
                <Plus className="w-4 h-4" strokeWidth={2} />
                添加商品
              </button>
            </div>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs text-gray-600">
                {activeCategoryId
                  ? `分类：${categories.find(c => c.id === activeCategoryId)?.name} — 共 ${productTotal} 个`
                  : `共 ${productTotal} 个商品`}
                ，第 {productPage * PRODUCT_PAGE_SIZE + 1}–{Math.min((productPage + 1) * PRODUCT_PAGE_SIZE, productTotal)} 条
              </span>
              {activeCategoryId && (
                <button onClick={() => loadProducts(wid, '', 0)} className="text-xs text-orange-500 hover:underline">× 清除分类筛选</button>
              )}
            </div>
            <div className="space-y-2">
              {filteredProducts.map(p => {
                const cat = categories.find(c => c.id === p.categoryId)
                return (
                  <div key={p.id} className="bg-white rounded-xl p-3 shadow-sm flex items-center gap-3">
                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-orange-50 flex items-center justify-center shrink-0">
                      {p.image ? <img src={p.image} alt={p.name} className="w-full h-full object-cover" /> : <Package className="w-6 h-6 text-orange-200" strokeWidth={1.5} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-800 truncate">{p.name}</div>
                      <div className="text-sm text-gray-600">{cat?.name} · {p.unit} · 库存:{p.stock}</div>
                      {p.barcode && <div className="text-xs text-gray-500">条码:{p.barcode}</div>}
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
            {productTotal > PRODUCT_PAGE_SIZE && (
              <div className="flex items-center justify-center gap-3 mt-4">
                <button disabled={productPage === 0} onClick={() => loadProducts(wid, search, productPage - 1, activeCategoryId)}
                  className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">← 上一页</button>
                <span className="text-sm text-gray-500">
                  {productPage + 1} / {Math.ceil(productTotal / PRODUCT_PAGE_SIZE)} 页
                </span>
                <button disabled={(productPage + 1) * PRODUCT_PAGE_SIZE >= productTotal} onClick={() => loadProducts(wid, search, productPage + 1, activeCategoryId)}
                  className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">下一页 →</button>
              </div>
            )}
          </div>
        )}

        {tab === 'import' && (
          <div>
            <div className="flex justify-end mb-3">
              <button onClick={clearAllData} disabled={clearing}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 disabled:opacity-60">
                <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                {clearing ? '清除中…' : '一键清除所有数据'}
              </button>
            </div>
            <BulkImport
              wholesalerId={wid}
              categories={categories}
              onDone={() => { setTab('products'); refreshData(wid) }}
            />
          </div>
        )}

        {tab === 'invites' && (
          <div className="max-w-2xl">
            <div className="bg-white rounded-xl p-6 shadow-sm mb-4">
              <h3 className="font-bold text-gray-800 mb-1">邀请新商家</h3>
              <p className="text-sm text-gray-600 mb-4">生成「商家号 + 临时密码」发给客户，客户 <b>2天内</b> 注册即成为你的客户，可浏览你的商品下单。</p>
              <button onClick={generateInvite} disabled={generating}
                className="px-5 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 disabled:opacity-60">
                {generating ? '生成中…' : '+ 生成邀请码'}
              </button>

              {newInvite && (
                <div className="mt-4 bg-orange-50 border border-orange-200 rounded-xl p-4">
                  <div className="flex items-center gap-1.5 text-xs text-orange-600 mb-2">
                    <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                    新邀请已生成，发给客户：
                  </div>
                  <div className="flex items-center justify-between bg-white rounded-lg px-4 py-2 mb-2">
                    <span className="text-sm text-gray-500">商家号</span>
                    <span className="font-bold text-gray-800 text-lg tracking-wider">{newInvite.code}</span>
                  </div>
                  <div className="flex items-center justify-between bg-white rounded-lg px-4 py-2 mb-3">
                    <span className="text-sm text-gray-500">临时密码</span>
                    <span className="font-bold text-gray-800 text-lg tracking-wider">{newInvite.tempPassword}</span>
                  </div>
                  <button
                    onClick={() => { navigator.clipboard?.writeText(`Yigo易购 商家号：${newInvite.code} 临时密码：${newInvite.tempPassword}（2天内有效，请在登录页"商家注册"输入）`); showToast('已复制邀请信息') }}
                    className="w-full py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 flex items-center justify-center gap-1.5">
                    <Copy className="w-4 h-4" strokeWidth={1.75} />
                    复制邀请信息
                  </button>
                  <div className="text-xs text-orange-500 mt-2 text-center">有效期至 {new Date(newInvite.expiresAt).toLocaleString('zh-CN')}</div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="text-sm font-medium text-gray-600 mb-3">已生成的邀请（{invites.length}）</div>
              {invites.length === 0 ? (
                <div className="text-center text-gray-500 py-8 text-sm">还没有邀请，点上方按钮生成</div>
              ) : (
                <div className="space-y-2">
                  {invites.map(inv => {
                    const st = inviteStatus(inv)
                    return (
                      <div key={inv.code} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                        <div>
                          <span className="font-medium text-gray-800 tracking-wider">{inv.code}</span>
                          <span className="text-gray-400 mx-2">·</span>
                          <span className="text-sm text-gray-500">密码 {inv.tempPassword}</span>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${st.color}`}>{st.label}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'categories' && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex gap-2 mb-4">
              <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="新分类名称" className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
              <button onClick={addCategory} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">添加</button>
            </div>
            <div className="space-y-1">
              {categories.map(c => (
                <button key={c.id}
                  onClick={() => {
                    setTab('products')
                    setSearch('')
                    loadProductsByCategory(c.id)
                  }}
                  className="w-full flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-orange-50 hover:text-orange-600 text-left border-b border-gray-50 last:border-0 transition-colors group">
                  <span className="text-gray-700 group-hover:text-orange-600">{c.name}</span>
                  <span className="text-xs text-gray-300 group-hover:text-orange-400">查看商品 →</span>
                </button>
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
                    <button onClick={() => { setImagePreview(''); setForm(f => ({ ...f, image: '' })) }} className="absolute top-2 right-2 w-7 h-7 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"><X className="w-3.5 h-3.5" strokeWidth={2} /></button>
                  </div>
                ) : (
                  <div onClick={() => fileInputRef.current?.click()} className="w-full h-32 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition-colors">
                    <Camera className="w-7 h-7 text-gray-300 mb-1.5" strokeWidth={1.5} />
                    <span className="text-sm text-gray-600">点击上传图片</span>
                    <span className="text-xs text-gray-500">JPG / PNG，最大 2MB</span>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              </div>

              {/* 多图：额外图片 */}
              <div>
                <label className="text-sm text-gray-500 mb-1 block">更多图片（第2、3、4张…）</label>
                <div className="flex gap-2 flex-wrap">
                  {/* existing extra images */}
                  {extraImages.map((url, i) => (
                    <div key={url} className="relative w-20 h-20 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button onClick={() => setExtraImages(imgs => imgs.filter((_, j) => j !== i))}
                        className="absolute top-1 right-1 w-5 h-5 bg-black/50 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-500 transition-colors">✕</button>
                    </div>
                  ))}
                  {/* new pending files (preview) */}
                  {newExtraFiles.map((f, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                      <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                      <button onClick={() => setNewExtraFiles(fs => fs.filter((_, j) => j !== i))}
                        className="absolute top-1 right-1 w-5 h-5 bg-black/50 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-500 transition-colors">✕</button>
                      <div className="absolute bottom-0 left-0 right-0 bg-orange-500 text-white text-[10px] text-center py-0.5">待上传</div>
                    </div>
                  ))}
                  {/* add button */}
                  <button onClick={() => extraImgRef.current?.click()}
                    className="w-20 h-20 border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-orange-400 hover:text-orange-400 transition-colors shrink-0 text-2xl">
                    +
                  </button>
                </div>
                <input ref={extraImgRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={e => { setNewExtraFiles(fs => [...fs, ...Array.from(e.target.files || [])]); e.target.value = '' }} />
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
              <div>
                <label className="text-sm text-gray-500 mb-1 flex items-center gap-1"><PlayCircle className="w-3.5 h-3.5" strokeWidth={1.75} /> 视频链接（选填）</label>
                <input value={form.videoUrl} onChange={e => setForm({ ...form, videoUrl: e.target.value })}
                  placeholder="https://youtube.com/... 或任意视频网址"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
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
