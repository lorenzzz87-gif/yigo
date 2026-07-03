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
  GripVertical,
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
  const [newCatName, setNewCatName] = useState('')
  const [dragCatIdx, setDragCatIdx] = useState<number | null>(null)
  const [sortModal, setSortModal] = useState<{ catId: string; catName: string } | null>(null)
  const [sortProducts, setSortProducts] = useState<Product[]>([])
  const [sortLoading, setSortLoading] = useState(false)
  const [dragProdIdx, setDragProdIdx] = useState<number | null>(null)
  const [savingSort, setSavingSort] = useState(false)
  const [sortSubcats, setSortSubcats] = useState<string[]>([])
  const [sortSelectedSubcat, setSortSelectedSubcat] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [toast, setToast] = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)

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
      store.countProducts(w, catId, undefined, q || undefined),
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

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const { compressImage } = await import('@/lib/imageUtils')
      const compressed = await compressImage(file)
      const reader = new FileReader()
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string
        setImagePreview(base64); setForm(f => ({ ...f, image: base64 }))
      }
      reader.readAsDataURL(compressed)
    } catch (err: any) { showToast('图片处理失败: ' + (err?.message || '未知错误')) }
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

  async function handleCatDrop(targetIdx: number) {
    if (dragCatIdx === null || dragCatIdx === targetIdx) { setDragCatIdx(null); return }
    const reordered = [...categories]
    const [moved] = reordered.splice(dragCatIdx, 1)
    reordered.splice(targetIdx, 0, moved)
    setCategories(reordered)
    setDragCatIdx(null)
    try { await store.reorderCategories(reordered.map(c => c.id)); showToast('分类顺序已保存') }
    catch (e: any) { showToast('保存失败: ' + e.message) }
  }

  async function openProductSort(cat: Category) {
    setSortModal({ catId: cat.id, catName: cat.name })
    setSortProducts([])
    setSortSelectedSubcat(null)
    setSortSubcats([])
    setSortLoading(true)
    const subs = await store.getSubcategories(wid, cat.id)
    setSortSubcats(subs)
    if (subs.length === 0) {
      // 无子分类 → 直接对大类下所有商品排序
      const prods = await store.getProducts(wid, undefined, 1000, 0, cat.id)
      setSortProducts(prods)
    }
    setSortLoading(false)
  }

  async function loadSortSubcat(sub: string) {
    if (!sortModal) return
    setSortSelectedSubcat(sub)
    setSortLoading(true)
    const prods = await store.getProducts(wid, undefined, 1000, 0, sortModal.catId, sub)
    setSortProducts(prods)
    setSortLoading(false)
  }

  function handleProdDrop(targetIdx: number) {
    if (dragProdIdx === null || dragProdIdx === targetIdx) { setDragProdIdx(null); return }
    const reordered = [...sortProducts]
    const [moved] = reordered.splice(dragProdIdx, 1)
    reordered.splice(targetIdx, 0, moved)
    setSortProducts(reordered)
    setDragProdIdx(null)
  }

  async function saveProductSort() {
    if (!sortModal) return
    setSavingSort(true)
    try {
      await store.reorderProducts(sortProducts.map(p => p.id))
      showToast(sortSelectedSubcat ? `「${sortSelectedSubcat}」排序已保存` : '商品排序已保存')
    } catch (e: any) { showToast('保存失败: ' + e.message) }
    setSavingSort(false)
    refreshData(wid)
    // 有子分类时回到子分类选择，方便继续排其它子分类；否则关闭
    if (sortSubcats.length > 0) { setSortSelectedSubcat(null); setSortProducts([]) }
    else setSortModal(null)
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
    pending_review: [{ label: '确认接单', next: 'confirmed' }, { label: '拒绝', next: 'cancelled' }],
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
    totalOrders: orders.filter(o => o.status !== 'cancelled').length,
    pendingOrders: orders.filter(o => o.status === 'pending' || o.status === 'pending_review').length,
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
              {orders.length === 0 && <div className="text-center text-gray-500 py-12">暂无订单</div>}
              {orders.map(order => (
                <div key={order.id} className={`bg-white rounded-xl p-4 shadow-sm ${order.status === 'pending_review' ? 'ring-2 ring-orange-300' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div><span className="font-semibold text-gray-800">{order.orderNo}</span><span className="ml-2 text-sm text-gray-600">{order.buyerName}</span></div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[order.status]}`}>{order.status === 'pending_review' ? '新订单 · 待接单' : getStatusLabel(order.status)}</span>
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
                placeholder="搜索编号 / 商品名 / 条形码，回车确认…"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 outline-none focus:border-orange-400" />
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
                      {p.sku && <div className="text-sm font-bold text-gray-900">编号：{p.sku}</div>}
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
              <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="新分类名称" className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:border-orange-400" />
              <button onClick={addCategory} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">添加</button>
            </div>
            <p className="text-xs text-gray-500 mb-2">拖动 <GripVertical className="inline w-3.5 h-3.5 -mt-0.5" /> 调整分类顺序（影响买家端显示顺序）；点「商品排序」拖动商品图片排序。</p>
            <div className="space-y-1">
              {categories.map((c, idx) => (
                <div key={c.id}
                  draggable
                  onDragStart={() => setDragCatIdx(idx)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => handleCatDrop(idx)}
                  className={`flex items-center gap-2 py-2 px-2 rounded-lg border transition-colors ${dragCatIdx === idx ? 'border-orange-300 bg-orange-50 opacity-60' : 'border-transparent hover:bg-gray-50'}`}>
                  <GripVertical className="w-4 h-4 text-gray-400 cursor-grab shrink-0" />
                  <span className="flex-1 text-gray-800 text-sm truncate">{c.name}</span>
                  <button onClick={() => openProductSort(c)}
                    className="text-xs px-2.5 py-1 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 shrink-0">商品排序</button>
                  <button onClick={() => { setTab('products'); setSearch(''); loadProductsByCategory(c.id) }}
                    className="text-xs px-2.5 py-1 text-gray-500 hover:text-orange-600 shrink-0">查看 →</button>
                </div>
              ))}
              {categories.length === 0 && <div className="text-center text-gray-400 py-8 text-sm">还没有分类</div>}
            </div>
          </div>
        )}
      </div>

      {showProductForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            <h3 className="font-bold text-gray-800 px-6 pt-6 pb-4 shrink-0">{editProduct ? '编辑商品' : '添加商品'}</h3>
            <div className="space-y-3 px-6 pb-4 overflow-y-auto flex-1">
              <div>
                <label className="text-sm text-gray-500 mb-1 block">商品图片</label>
                {imagePreview ? (
                  <div className="relative w-full h-40 rounded-xl overflow-hidden bg-gray-100">
                    <img src={imagePreview} alt="预览" className="w-full h-full object-cover" />
                    <button onClick={() => { setImagePreview(''); setForm(f => ({ ...f, image: '' })) }} className="absolute top-2 right-2 w-7 h-7 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"><X className="w-3.5 h-3.5" strokeWidth={2} /></button>
                  </div>
                ) : (
                  <label className="w-full h-32 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition-colors">
                    <Camera className="w-7 h-7 text-gray-400 mb-1.5" strokeWidth={1.5} />
                    <span className="text-sm text-gray-600">点击上传图片</span>
                    <span className="text-xs text-gray-500">JPG / PNG，大图自动压缩</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                  </label>
                )}
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
                  {/* add button — label直接触发input，比programmatic click更可靠 */}
                  <label className="w-20 h-20 border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:border-orange-400 hover:text-orange-400 transition-colors shrink-0 text-2xl cursor-pointer">
                    +
                    <input type="file" accept="image/*" multiple className="hidden"
                      onChange={e => { const files = Array.from(e.target.files || []); e.target.value = ''; setNewExtraFiles(fs => [...fs, ...files]) }} />
                  </label>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-500 mb-1 block">商品名称 *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:border-orange-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-500 mb-1 block">分类</label>
                  <select value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:border-orange-400">
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-500 mb-1 block">单位</label>
                  <input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:border-orange-400" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-500 mb-1 block">价格 (€) *</label>
                  <input type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:border-orange-400" />
                </div>
                <div>
                  <label className="text-sm text-gray-500 mb-1 block">库存</label>
                  <input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:border-orange-400" />
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-500 mb-1 block">条形码</label>
                <input value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:border-orange-400" />
              </div>
              <div>
                <label className="text-sm text-gray-500 mb-1 flex items-center gap-1"><PlayCircle className="w-3.5 h-3.5" strokeWidth={1.75} /> 视频链接（选填）</label>
                <input value={form.videoUrl} onChange={e => setForm({ ...form, videoUrl: e.target.value })}
                  placeholder="https://youtube.com/... 或任意视频网址"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:border-orange-400 placeholder:text-gray-400" />
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100 bg-white shrink-0">
              <button onClick={() => setShowProductForm(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-gray-600 text-sm hover:bg-gray-50">取消</button>
              <button onClick={saveProduct} disabled={saving} className="flex-1 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 disabled:opacity-60">
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 商品拖动排序弹窗 */}
      {sortModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            {(() => {
              const pickingSubcat = sortSubcats.length > 0 && sortSelectedSubcat === null
              return <>
                <div className="px-6 pt-5 pb-3 shrink-0">
                  <h3 className="font-bold text-gray-800">
                    商品排序 · {sortModal.catName}
                    {sortSelectedSubcat && <span className="text-orange-500"> / {sortSelectedSubcat}</span>}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {pickingSubcat ? '该大类含子分类，请选择要排序的子分类。' : '拖动图片调整顺序，左上角数字为买家端显示位置。'}
                  </p>
                  {sortSelectedSubcat && (
                    <button onClick={() => { setSortSelectedSubcat(null); setSortProducts([]) }} className="text-xs text-orange-500 hover:underline mt-1">← 返回子分类列表</button>
                  )}
                </div>
                <div className="px-6 pb-4 overflow-y-auto flex-1">
                  {sortLoading ? (
                    <div className="text-center text-gray-400 py-16 text-sm">加载中…</div>
                  ) : pickingSubcat ? (
                    <div className="space-y-1.5">
                      {sortSubcats.map(sub => (
                        <button key={sub} onClick={() => loadSortSubcat(sub)}
                          className="w-full flex items-center justify-between py-3 px-4 rounded-xl border border-gray-100 hover:border-orange-300 hover:bg-orange-50 text-left transition-colors group">
                          <span className="text-gray-800 text-sm group-hover:text-orange-600">{sub}</span>
                          <span className="text-xs text-gray-400 group-hover:text-orange-500">排序 →</span>
                        </button>
                      ))}
                    </div>
                  ) : sortProducts.length === 0 ? (
                    <div className="text-center text-gray-400 py-16 text-sm">该分类下暂无商品</div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {sortProducts.map((p, idx) => (
                        <div key={p.id}
                          draggable
                          onDragStart={() => setDragProdIdx(idx)}
                          onDragOver={e => e.preventDefault()}
                          onDrop={() => handleProdDrop(idx)}
                          className={`relative rounded-lg overflow-hidden border-2 cursor-grab bg-gray-50 ${dragProdIdx === idx ? 'border-orange-400 opacity-50' : 'border-transparent'}`}>
                          <div className="absolute top-1 left-1 z-10 w-5 h-5 bg-orange-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center">{idx + 1}</div>
                          <div className="w-full aspect-square flex items-center justify-center">
                            {p.image ? <img src={p.image} alt={p.name} className="w-full h-full object-contain pointer-events-none" /> : <Package className="w-6 h-6 text-gray-300" strokeWidth={1.5} />}
                          </div>
                          <div className="px-1.5 py-1 text-[11px] text-gray-600 truncate bg-white">{p.name}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-3 px-6 py-4 border-t border-gray-100 bg-white shrink-0">
                  <button onClick={() => setSortModal(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-gray-600 text-sm hover:bg-gray-50">关闭</button>
                  {!pickingSubcat && (
                    <button onClick={saveProductSort} disabled={savingSort || sortLoading || sortProducts.length === 0} className="flex-1 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 disabled:opacity-60">
                      {savingSort ? '保存中…' : '保存排序'}
                    </button>
                  )}
                </div>
              </>
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
