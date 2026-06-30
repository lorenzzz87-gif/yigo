'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { store, User, Product, Category, Order, BuyerProfile } from '@/lib/store'

type Lang = 'it' | 'zh'

const T: Record<Lang, Record<string, string>> = {
  it: { catalog: 'Catalogo', myOrders: 'I miei ordini', profilo: 'Profilo', search: 'Cerca prodotti…', all: 'Tutti', cart: 'Carrello', stock: 'Disponibilità', total: 'Totale', submit: 'Invia ordine', submitting: 'Invio…', sent: 'Ordine inviato!', empty: 'Il carrello è vuoto', note: 'Note', notePh: 'Es. consegnare al più presto…', logout: 'Esci', noProducts: 'Nessun prodotto disponibile', noOrders: 'Nessun ordine', addToCart: 'Aggiungi', items: 'articoli', qty: 'Q.tà', mobileVer: '手机版', backCatalog: 'Continua acquisti', remove: 'Rimuovi', checkout: 'Vai al carrello', save: 'Salva', saving: 'Salvataggio…', saved: '✓ Salvato', profiloDesc: 'Dati utilizzati per fatturazione, spedizioni e comunicazioni ordini.' },
  zh: { catalog: '商品目录', myOrders: '我的订单', profilo: '我的资料', search: '搜索商品…', all: '全部', cart: '购物车', stock: '库存', total: '合计', submit: '提交订单', submitting: '提交中…', sent: '下单成功！', empty: '购物车为空', note: '备注', notePh: '如：请尽快发货…', logout: '退出', noProducts: '暂无商品', noOrders: '暂无订单', addToCart: '加入', items: '种商品', qty: '数量', mobileVer: '手机版', backCatalog: '继续选购', remove: '移除', checkout: '去购物车', save: '保存', saving: '保存中…', saved: '✓ 已保存', profiloDesc: '用于开票、物流发货和订单通知的信息。' },
}
const STATUS: Record<Lang, Record<string, string>> = {
  it: { pending_review: 'In revisione', pending: 'In attesa di conferma', confirmed: 'Confermato', shipped: 'Spedito', completed: 'Completato', cancelled: 'Annullato' },
  zh: { pending_review: '审核中', pending: '待批发商确认', confirmed: '已确认', shipped: '已发货', completed: '已完成', cancelled: '已取消' },
}
const STATUS_COLOR: Record<string, string> = {
  pending_review: 'bg-orange-100 text-orange-700', pending: 'bg-yellow-100 text-yellow-700', confirmed: 'bg-blue-100 text-blue-700',
  shipped: 'bg-purple-100 text-purple-700', completed: 'bg-green-100 text-green-700', cancelled: 'bg-gray-100 text-gray-500',
}

export default function B2BPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [lang, setLang] = useState<Lang>('it')
  const [view, setView] = useState<'catalog' | 'orders' | 'profilo'>('catalog')
  const [products, setProducts] = useState<Product[]>([])
  const [productTotal, setProductTotal] = useState(0)
  const [productPage, setProductPage] = useState(0)
  const PAGE_SIZE = 60
  const [cartProductsCache, setCartProductsCache] = useState<Record<string, Product>>({})
  const [categories, setCategories] = useState<Category[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [selectedCat, setSelectedCat] = useState('all')
  const [selectedSubcat, setSelectedSubcat] = useState<string | null>(null)
  const [subcategories, setSubcategories] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [cart, setCart] = useState(store.getCart())
  const [cartOpen, setCartOpen] = useState(false)
  const [remark, setRemark] = useState('')
  const [placing, setPlacing] = useState(false)
  const [toast, setToast] = useState('')
  const [unitPicker, setUnitPicker] = useState<string | null>(null)
  const [detailProduct, setDetailProduct] = useState<Product | null>(null)
  const [wholesalerLogo, setWholesalerLogo] = useState<string | null>(null)
  const [profile, setProfile] = useState<BuyerProfile | null>(null)
  const [profileForm, setProfileForm] = useState<Omit<BuyerProfile, 'userId'>>({})
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)

  const t = T[lang]

  useEffect(() => {
    const u = store.getCurrentUser()
    if (!u || u.role !== 'buyer') { router.replace('/login'); return }
    setUser(u)
    const savedLang = (typeof window !== 'undefined' && localStorage.getItem('yg_lang')) as Lang | null
    if (savedLang) setLang(savedLang)
    Promise.all([store.getCategories(u.wholesalerId), store.getOrdersByBuyer(u.id), store.getWholesalerLogo(u.wholesalerId!), store.getBuyerProfile(u.id)]).then(([c, o, logo, prof]) => {
      setCategories(c); setOrders(o)
      if (logo) setWholesalerLogo(logo)
      const p = prof || { userId: u.id }
      setProfile(p)
      setProfileForm({ ragioneSociale: p.ragioneSociale, piva: p.piva, codiceFiscale: p.codiceFiscale, indirizzoFattura: p.indirizzoFattura, capFattura: p.capFattura, cittaFattura: p.cittaFattura, provinciaFattura: p.provinciaFattura, codiceSdi: p.codiceSdi, pec: p.pec, indirizzoSpedizione: p.indirizzoSpedizione, capSpedizione: p.capSpedizione, cittaSpedizione: p.cittaSpedizione, noteConsegna: p.noteConsegna, emailOrdini: p.emailOrdini, telefono: p.telefono })
    })
    loadProducts(u.wholesalerId, '', 0, undefined)
  }, [router])

  async function loadProducts(wid: string | undefined, q: string, page: number, catId?: string, subcat?: string) {
    const [prods, total] = await Promise.all([
      store.getProducts(wid, q || undefined, PAGE_SIZE, page * PAGE_SIZE, catId, subcat),
      store.countProducts(wid, catId, subcat),
    ])
    setProducts(prods); setProductTotal(total); setProductPage(page)
  }

  async function selectCategory(catId: string) {
    // clicking the already-active category collapses it back to "all"
    if (catId !== 'all' && catId === selectedCat) {
      setSelectedCat('all'); setSelectedSubcat(null); setSubcategories([])
      setSearch(''); setSearchInput('')
      loadProducts(user?.wholesalerId, '', 0, undefined)
      return
    }
    setSelectedCat(catId)
    setSelectedSubcat(null)
    setSubcategories([])
    setSearch(''); setSearchInput('')
    loadProducts(user?.wholesalerId, '', 0, catId === 'all' ? undefined : catId)
    if (catId !== 'all' && user?.wholesalerId) {
      const subs = await store.getSubcategories(user.wholesalerId, catId)
      setSubcategories(subs)
    }
  }

  function selectSubcat(sub: string | null) {
    setSelectedSubcat(sub)
    loadProducts(user?.wholesalerId, '', 0, selectedCat === 'all' ? undefined : selectedCat, sub || undefined)
  }

  function runSearch() {
    setSelectedCat('all')
    setSelectedSubcat(null)
    setSubcategories([])
    setSearch(searchInput)
    loadProducts(user?.wholesalerId, searchInput, 0, undefined)
  }

  function goPage(page: number) {
    loadProducts(user?.wholesalerId, search, page, selectedCat === 'all' ? undefined : selectedCat, selectedSubcat || undefined)
  }

  function switchLang(l: Lang) { setLang(l); localStorage.setItem('yg_lang', l) }
  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2500) }
  function refreshCart() { setCart(store.getCart()) }
  function addToCart(id: string, orderUnit: import('@/lib/store').OrderUnit = 'pack') {
    store.addToCart(id, 1, orderUnit); refreshCart()
    const p = products.find(p => p.id === id)
    if (p) setCartProductsCache(prev => ({ ...prev, [id]: p }))
    setUnitPicker(null)
  }
  function updateQty(id: string, q: number, orderUnit: import('@/lib/store').OrderUnit = 'pack') { store.updateCartItem(id, q, orderUnit); refreshCart() }

  // Cart needs full product info even for items added on a different page — merge cache with current page
  const productsForCart = { ...cartProductsCache, ...Object.fromEntries(products.map(p => [p.id, p])) }
  const cartProductList = Object.values(productsForCart)

  async function placeOrder() {
    if (!user || cart.length === 0) return
    setPlacing(true)
    await store.createOrder(user.id, user.name, cart, cartProductList, user.wholesalerId!, remark)
    setCart([]); setRemark(''); setCartOpen(false); setCartProductsCache({})
    const o = await store.getOrdersByBuyer(user.id)
    setOrders(o); setView('orders')
    showToast(t.sent); setPlacing(false)
  }

  async function saveProfile() {
    if (!user) return
    setProfileSaving(true)
    await store.saveBuyerProfile({ userId: user.id, ...profileForm })
    setProfileSaved(true); setTimeout(() => setProfileSaved(false), 3000)
    setProfileSaving(false)
  }

  function logout() { store.setCurrentUser(null); router.push('/entry') }

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)
  const cartTotal = cart.reduce((s, i) => {
    const p = productsForCart[i.productId]
    if (!p) return s
    const unitPrice = i.orderUnit === 'box' && p.boxQty ? p.price * p.boxQty : p.price
    return s + unitPrice * i.quantity
  }, 0)

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      {toast && <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-5 py-2.5 rounded-full z-[60] shadow-lg">{toast}</div>}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-6">
          <div className="flex items-center gap-3 shrink-0">
            <img src="/logo.svg" alt="Yigo" className="h-9 w-auto" />
            <span className="text-xs font-semibold bg-orange-100 text-orange-600 px-2 py-0.5 rounded">B2B</span>
            {wholesalerLogo && <img src={wholesalerLogo} alt="logo" className="h-8 w-auto max-w-[80px] object-contain border-l border-gray-200 pl-3" />}
          </div>

          <div className="flex-1 max-w-xl">
            <div className="relative">
              <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runSearch()}
                placeholder={t.search}
                className="w-full bg-gray-100 rounded-full pl-11 pr-4 py-2.5 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-orange-300 transition" />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex bg-gray-100 rounded-full p-0.5 text-xs font-medium">
              <button onClick={() => switchLang('it')} className={`px-3 py-1 rounded-full ${lang === 'it' ? 'bg-white shadow text-orange-600' : 'text-gray-500'}`}>IT</button>
              <button onClick={() => switchLang('zh')} className={`px-3 py-1 rounded-full ${lang === 'zh' ? 'bg-white shadow text-orange-600' : 'text-gray-500'}`}>中</button>
            </div>
            <button onClick={() => setCartOpen(true)} className="relative px-4 py-2 bg-orange-500 text-white rounded-full text-sm font-medium hover:bg-orange-600">
              🛒 {t.cart}
              {cartCount > 0 && <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">{cartCount}</span>}
            </button>
            <div className="text-sm text-gray-600 hidden md:block">{user.name}</div>
            <button onClick={logout} className="text-sm text-gray-400 hover:text-red-500">{t.logout}</button>
          </div>
        </div>

        {/* sub nav */}
        <div className="max-w-7xl mx-auto px-6 flex gap-6 -mb-px">
          {([['catalog', t.catalog], ['orders', t.myOrders], ['profilo', t.profilo]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setView(k)}
              className={`py-3 text-sm font-medium border-b-2 transition ${view === k ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {view === 'catalog' && (
          <div className="flex gap-6">
            {/* Sidebar categories — two-level: 大类 → 子分类 */}
            <aside className="w-52 shrink-0">
              <div className="bg-white rounded-xl p-2 shadow-sm sticky top-32 max-h-[calc(100vh-10rem)] overflow-y-auto">
                <button onClick={() => selectCategory('all')}
                  className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium mb-0.5 ${selectedCat === 'all' ? 'bg-orange-50 text-orange-600' : 'text-gray-600 hover:bg-gray-50'}`}>
                  {t.all}
                </button>
                {categories.map(c => (
                  <div key={c.id}>
                    <button onClick={() => selectCategory(c.id)}
                      className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium mb-0.5 flex items-center justify-between ${selectedCat === c.id ? 'bg-orange-50 text-orange-600' : 'text-gray-600 hover:bg-gray-50'}`}>
                      <span className="truncate">{c.name}</span>
                      {selectedCat === c.id && subcategories.length > 0 && <span className="text-xs shrink-0 ml-1">▾</span>}
                    </button>
                    {selectedCat === c.id && subcategories.length > 0 && (
                      <div className="ml-3 mb-1 border-l-2 border-orange-100 pl-2">
                        {subcategories.map(sub => (
                          <button key={sub} onClick={() => selectSubcat(selectedSubcat === sub ? null : sub)}
                            className={`w-full text-left px-2 py-1.5 rounded-lg text-xs mb-0.5 ${selectedSubcat === sub ? 'bg-orange-100 text-orange-700 font-semibold' : 'text-gray-500 hover:bg-gray-50'}`}>
                            {sub}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </aside>

            {/* Product grid */}
            <main className="flex-1">
              <div className="text-xs text-gray-400 mb-3">
                {productTotal} {t.items}，{productPage * PAGE_SIZE + 1}–{Math.min((productPage + 1) * PAGE_SIZE, productTotal)}
              </div>
              {products.length === 0 ? (
                <div className="text-center text-gray-400 py-24">{t.noProducts}</div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {products.map(p => {
                    const packItem = cart.find(i => i.productId === p.id && i.orderUnit === 'pack')
                    const boxItem  = cart.find(i => i.productId === p.id && i.orderUnit === 'box')
                    const showPicker = unitPicker === p.id
                    return (
                      <div key={p.id} className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition flex flex-col">
                        <div className="w-full aspect-square bg-orange-50 flex items-center justify-center cursor-pointer" onClick={() => setDetailProduct(p)}>
                          {p.image ? <img src={p.image} alt={p.name} className="w-full h-full object-contain" /> : <span className="text-5xl">📦</span>}
                        </div>
                        <div className="p-3 flex flex-col flex-1">
                          <div className="font-medium text-gray-800 text-sm mb-1 line-clamp-2 min-h-[2.5rem]">{p.name}</div>
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            {p.subcategory && <span className="text-xs bg-orange-50 text-orange-500 px-1.5 py-0.5 rounded">{p.subcategory}</span>}
                            <span className="text-xs text-gray-400">{t.stock}: {p.stock} pz</span>
                            {p.videoUrl && <a href={p.videoUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline">🎬 Video</a>}
                          </div>
                          <div className="mt-auto flex items-center justify-between">
                            <span className="font-bold text-orange-500 text-lg">€{p.price.toFixed(2)}</span>
                            {(packItem || boxItem) ? (
                              <div className="flex flex-col gap-1 items-end">
                                {packItem && (
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-gray-400">{lang === 'it' ? 'Cf' : '包'}</span>
                                    <button onClick={() => updateQty(p.id, packItem.quantity - 1, 'pack')} className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 font-bold flex items-center justify-center hover:bg-orange-200">−</button>
                                    <span className="w-5 text-center font-medium text-sm">{packItem.quantity}</span>
                                    <button onClick={() => updateQty(p.id, packItem.quantity + 1, 'pack')} className="w-6 h-6 rounded-full bg-orange-500 text-white font-bold flex items-center justify-center hover:bg-orange-600">+</button>
                                  </div>
                                )}
                                {boxItem && (
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-gray-400">{lang === 'it' ? 'Cx' : '箱'}</span>
                                    <button onClick={() => updateQty(p.id, boxItem.quantity - 1, 'box')} className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 font-bold flex items-center justify-center hover:bg-orange-200">−</button>
                                    <span className="w-5 text-center font-medium text-sm">{boxItem.quantity}</span>
                                    <button onClick={() => updateQty(p.id, boxItem.quantity + 1, 'box')} className="w-6 h-6 rounded-full bg-orange-500 text-white font-bold flex items-center justify-center hover:bg-orange-600">+</button>
                                  </div>
                                )}
                              </div>
                            ) : showPicker ? (
                              <div className="flex flex-col gap-1 items-end">
                                <button onClick={() => addToCart(p.id, 'pack')} className="text-xs px-2 py-1 bg-orange-500 text-white rounded-lg font-medium whitespace-nowrap">
                                  {lang === 'it' ? `Conf. ${p.unit} pz` : `中包 ${p.unit} pz`}
                                </button>
                                {p.boxQty && (
                                  <button onClick={() => addToCart(p.id, 'box')} className="text-xs px-2 py-1 bg-orange-700 text-white rounded-lg font-medium whitespace-nowrap">
                                    {lang === 'it' ? `Cartone ${p.boxQty} pz` : `整箱 ${p.boxQty} pz`}
                                  </button>
                                )}
                                <button onClick={() => setUnitPicker(null)} className="text-xs text-gray-400">✕</button>
                              </div>
                            ) : (
                              <button onClick={() => p.boxQty ? setUnitPicker(p.id) : addToCart(p.id, 'pack')} className="px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600">+ {t.addToCart}</button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              {productTotal > PAGE_SIZE && (
                <div className="flex items-center justify-center gap-3 mt-6">
                  <button disabled={productPage === 0} onClick={() => goPage(productPage - 1)}
                    className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">← </button>
                  <span className="text-sm text-gray-500">{productPage + 1} / {Math.ceil(productTotal / PAGE_SIZE)}</span>
                  <button disabled={(productPage + 1) * PAGE_SIZE >= productTotal} onClick={() => goPage(productPage + 1)}
                    className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"> →</button>
                </div>
              )}
            </main>
          </div>
        )}

        {view === 'orders' && (
          <div className="max-w-3xl">
            {orders.length === 0 ? (
              <div className="text-center text-gray-400 py-24">{t.noOrders}</div>
            ) : (
              <div className="space-y-3">
                {orders.map(o => (
                  <div key={o.id} className="bg-white rounded-xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold text-gray-800">{o.orderNo}</span>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLOR[o.status]}`}>{STATUS[lang][o.status]}</span>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 mb-3 space-y-1">
                      {o.items.map((i, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-gray-700">{i.productName} × {i.quantity}{i.unit}</span>
                          <span className="text-gray-500">€{(i.price * i.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-400">{new Date(o.createdAt).toLocaleString(lang === 'it' ? 'it-IT' : 'zh-CN')}</span>
                      <span className="font-bold text-orange-500 text-lg">€{o.totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'profilo' && (
          <div className="max-w-2xl space-y-5">
            <p className="text-sm text-gray-600">{t.profiloDesc}</p>

            {/* Dati fatturazione */}
            <section className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">🧾 {lang === 'it' ? 'Dati fatturazione' : '开票信息'}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { key: 'ragioneSociale', label: lang === 'it' ? 'Ragione Sociale' : '公司名称', full: true },
                  { key: 'piva', label: 'P.IVA' },
                  { key: 'codiceFiscale', label: lang === 'it' ? 'Codice Fiscale' : '税号' },
                  { key: 'indirizzoFattura', label: lang === 'it' ? 'Indirizzo' : '地址', full: true },
                  { key: 'capFattura', label: 'CAP' },
                  { key: 'cittaFattura', label: lang === 'it' ? 'Città' : '城市' },
                  { key: 'provinciaFattura', label: lang === 'it' ? 'Provincia' : '省份', placeholder: 'es. NA' },
                  { key: 'codiceSdi', label: 'Codice SDI', placeholder: '7 caratteri' },
                  { key: 'pec', label: 'PEC', placeholder: 'fattura@pec.it' },
                ].map(f => (
                  <div key={f.key} className={f.full ? 'sm:col-span-2' : ''}>
                    <label className="text-xs font-medium text-gray-500 block mb-1">{f.label}</label>
                    <input
                      value={(profileForm as any)[f.key] || ''}
                      onChange={e => setProfileForm(pf => ({ ...pf, [f.key]: e.target.value }))}
                      placeholder={f.placeholder || ''}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200 transition"
                    />
                  </div>
                ))}
              </div>
            </section>

            {/* Indirizzo spedizione */}
            <section className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2">📦 {lang === 'it' ? 'Indirizzo spedizione' : '收货地址'}</h3>
              <p className="text-xs text-gray-500 mb-4">{lang === 'it' ? 'Lascia vuoto se uguale alla fatturazione.' : '如与开票地址相同可留空。'}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { key: 'indirizzoSpedizione', label: lang === 'it' ? 'Indirizzo' : '地址', full: true },
                  { key: 'capSpedizione', label: 'CAP' },
                  { key: 'cittaSpedizione', label: lang === 'it' ? 'Città' : '城市' },
                  { key: 'noteConsegna', label: lang === 'it' ? 'Note di consegna' : '收货备注', full: true, placeholder: lang === 'it' ? 'es. chiamare prima della consegna' : '如：请提前联系' },
                ].map(f => (
                  <div key={f.key} className={f.full ? 'sm:col-span-2' : ''}>
                    <label className="text-xs font-medium text-gray-500 block mb-1">{f.label}</label>
                    <input
                      value={(profileForm as any)[f.key] || ''}
                      onChange={e => setProfileForm(pf => ({ ...pf, [f.key]: e.target.value }))}
                      placeholder={f.placeholder || ''}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200 transition"
                    />
                  </div>
                ))}
              </div>
            </section>

            {/* Contatti ordini */}
            <section className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">📬 {lang === 'it' ? 'Contatti per ordini' : '订单联系方式'}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-gray-500 block mb-1">{lang === 'it' ? 'Email per conferme ordine' : '接收订单确认邮箱'}</label>
                  <input type="email" value={profileForm.emailOrdini || ''} onChange={e => setProfileForm(pf => ({ ...pf, emailOrdini: e.target.value }))}
                    placeholder="ordini@miazienda.it"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200 transition" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-gray-500 block mb-1">{lang === 'it' ? 'Numero di contatto' : '联系电话'}</label>
                  <input type="tel" value={profileForm.telefono || ''} onChange={e => setProfileForm(pf => ({ ...pf, telefono: e.target.value }))}
                    placeholder="+39 333 1234567"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200 transition" />
                </div>
              </div>
            </section>

            <button onClick={saveProfile} disabled={profileSaving}
              className="w-full py-3.5 bg-orange-500 text-white font-semibold rounded-2xl hover:bg-orange-600 disabled:opacity-60 transition text-base">
              {profileSaved ? t.saved : profileSaving ? t.saving : t.save}
            </button>
          </div>
        )}
      </div>

      {/* Product detail modal */}
      {detailProduct && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setDetailProduct(null)}>
          <div className="bg-white w-full max-w-lg rounded-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="relative bg-gray-50 flex items-center justify-center" style={{minHeight: '280px'}}>
              {detailProduct.image
                ? <img src={detailProduct.image} alt={detailProduct.name} className="w-full object-contain max-h-72" />
                : <span className="text-7xl">📦</span>
              }
              <button onClick={() => setDetailProduct(null)} className="absolute top-3 right-3 w-8 h-8 bg-black/40 text-white rounded-full flex items-center justify-center text-lg">✕</button>
            </div>
            <div className="p-5 overflow-y-auto">
              <div className="font-bold text-gray-800 text-xl mb-1">{detailProduct.name}</div>
              {detailProduct.subcategory && <span className="inline-block text-xs bg-orange-50 text-orange-500 px-2 py-0.5 rounded mb-3">{detailProduct.subcategory}</span>}
              <div className="text-3xl font-bold text-orange-500 mb-4">€{detailProduct.price.toFixed(2)}</div>
              <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="text-gray-500 text-xs mb-1">{lang === 'it' ? 'Conf.' : '中包装'}</div>
                  <div className="font-semibold text-gray-800">{detailProduct.unit} pz</div>
                </div>
                {detailProduct.boxQty && (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <div className="text-gray-500 text-xs mb-1">{lang === 'it' ? 'Cartone' : '装箱数'}</div>
                    <div className="font-semibold text-gray-800">{detailProduct.boxQty} pz</div>
                  </div>
                )}
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="text-gray-500 text-xs mb-1">{t.stock}</div>
                  <div className="font-semibold text-gray-800">{detailProduct.stock} pz</div>
                </div>
                {detailProduct.barcode && (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <div className="text-gray-500 text-xs mb-1">{lang === 'it' ? 'Codice' : '条形码'}</div>
                    <div className="font-semibold text-gray-800 text-xs">{detailProduct.barcode}</div>
                  </div>
                )}
              </div>
              {detailProduct.description && <div className="text-sm text-gray-500 mb-4">{detailProduct.description}</div>}
              {detailProduct.videoUrl && <a href={detailProduct.videoUrl} target="_blank" rel="noreferrer" className="block text-sm text-blue-500 hover:underline mb-4">🎬 {lang === 'it' ? 'Guarda il video' : '查看产品视频'}</a>}
              <button
                onClick={() => { detailProduct.boxQty ? setUnitPicker(detailProduct.id) : addToCart(detailProduct.id, 'pack'); setDetailProduct(null) }}
                className="w-full py-3.5 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 text-lg">
                + {t.addToCart}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCartOpen(false)} />
          <div className="relative w-full max-w-md bg-white h-full shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-5 h-16 border-b border-gray-200 shrink-0">
              <h3 className="font-bold text-gray-800">{t.cart}</h3>
              <button onClick={() => setCartOpen(false)} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500">✕</button>
            </div>

            {cart.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-gray-400">{t.empty}</div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                  {cart.map((item, idx) => {
                    const p = productsForCart[item.productId]
                    if (!p) return null
                    const isBox = item.orderUnit === 'box' && p.boxQty
                    const unitPrice = isBox ? p.price * p.boxQty! : p.price
                    const unitLabel = isBox ? (lang === 'it' ? 'cartone' : '箱') : (lang === 'it' ? 'cf' : p.unit)
                    return (
                      <div key={`${item.productId}_${item.orderUnit}_${idx}`} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                        <div className="w-14 h-14 rounded-lg overflow-hidden bg-white flex items-center justify-center shrink-0">
                          {p.image ? <img src={p.image} alt={p.name} className="w-full h-full object-cover" /> : <span className="text-2xl">📦</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-800 text-sm truncate">{p.name}</div>
                          <div className="text-sm text-orange-500 font-semibold">€{unitPrice.toFixed(2)} / {unitLabel}{isBox && <span className="text-xs text-gray-400 ml-1">({p.boxQty} cf)</span>}</div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button onClick={() => updateQty(item.productId, item.quantity - 1, item.orderUnit)} className="w-7 h-7 rounded-full bg-gray-200 font-bold flex items-center justify-center">−</button>
                          <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                          <button onClick={() => updateQty(item.productId, item.quantity + 1, item.orderUnit)} className="w-7 h-7 rounded-full bg-orange-500 text-white font-bold flex items-center justify-center">+</button>
                        </div>
                      </div>
                    )
                  })}
                  <div>
                    <label className="text-sm text-gray-500 block mb-1">{t.note}</label>
                    <textarea value={remark} onChange={e => setRemark(e.target.value)} placeholder={t.notePh} rows={2}
                      className="w-full border border-gray-200 rounded-lg p-2.5 text-sm outline-none focus:border-orange-400 resize-none" />
                  </div>
                </div>

                <div className="border-t border-gray-200 p-5 shrink-0">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gray-500">{t.total}</span>
                    <span className="text-2xl font-bold text-orange-500">€{cartTotal.toFixed(2)}</span>
                  </div>
                  <button onClick={placeOrder} disabled={placing}
                    className="w-full py-3.5 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-60">
                    {placing ? t.submitting : t.submit}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
