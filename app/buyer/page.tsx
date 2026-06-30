'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { store, User, Product, Category } from '@/lib/store'
import Navbar from '@/components/navbar'

export default function BuyerPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [tab, setTab] = useState<'shop' | 'cart' | 'orders'>('shop')
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCat, setSelectedCat] = useState('all')
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState(store.getCart())
  const [remark, setRemark] = useState('')
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof store.getOrders>>>([])
  const [toast, setToast] = useState('')
  const [placing, setPlacing] = useState(false)
  const [unitPicker, setUnitPicker] = useState<string | null>(null) // productId showing pack/box picker

  useEffect(() => {
    const u = store.getCurrentUser()
    if (!u || u.role !== 'buyer') { router.replace('/login'); return }
    setUser(u)
    Promise.all([store.getProducts(u.wholesalerId), store.getCategories(u.wholesalerId), store.getOrdersByBuyer(u.id)]).then(([p, c, o]) => {
      setProducts(p); setCategories(c); setOrders(o)
    })
  }, [router])

  function refreshCart() { setCart(store.getCart()) }

  function addToCart(productId: string, orderUnit: import('@/lib/store').OrderUnit = 'pack') {
    store.addToCart(productId, 1, orderUnit); refreshCart()
    showToast(orderUnit === 'box' ? '已加入购物车（整箱）' : '已加入购物车（中包）')
    setUnitPicker(null)
  }
  function updateQty(productId: string, qty: number, orderUnit: import('@/lib/store').OrderUnit = 'pack') { store.updateCartItem(productId, qty, orderUnit); refreshCart() }
  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2000) }

  async function placeOrder() {
    if (!user || cart.length === 0) return
    setPlacing(true)
    await store.createOrder(user.id, user.name, cart, products, user.wholesalerId!, remark)
    setCart([])
    setRemark('')
    const o = await store.getOrdersByBuyer(user.id)
    setOrders(o)
    setTab('orders')
    showToast('下单成功！')
    setPlacing(false)
  }

  function productEmoji(categoryId: string) {
    const map: Record<string, string> = { c1: '🥤', c2: '🍟', c3: '🧴', c4: '🌾' }
    return map[categoryId] || '📦'
  }

  const filtered = products.filter(p => (selectedCat === 'all' || p.categoryId === selectedCat) && (!search || p.name.includes(search)))
  const cartTotal = cart.reduce((sum, item) => {
    const p = products.find(p => p.id === item.productId)
    if (!p) return sum
    const unitPrice = item.orderUnit === 'box' && p.boxQty ? p.price * p.boxQty : p.price
    return sum + unitPrice * item.quantity
  }, 0)

  const statusColor: Record<string, string> = { pending_review: 'bg-orange-100 text-orange-700', pending: 'bg-yellow-100 text-yellow-700', confirmed: 'bg-blue-100 text-blue-700', shipped: 'bg-purple-100 text-purple-700', completed: 'bg-green-100 text-green-700', cancelled: 'bg-gray-100 text-gray-500' }
  const statusLabel: Record<string, string> = { pending_review: '审核中', pending: '待批发商确认', confirmed: '已确认', shipped: '已发货', completed: '已完成', cancelled: '已取消' }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navbar user={user} title="采购下单" />
      {toast && <div className="fixed top-16 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-sm px-4 py-2 rounded-full z-50 shadow">{toast}</div>}
      <div className="max-w-4xl mx-auto px-4 py-4">
        {tab === 'shop' && (
          <div>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索商品…" className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400 mb-3" />
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
              <button onClick={() => setSelectedCat('all')} className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium ${selectedCat === 'all' ? 'bg-orange-500 text-white' : 'bg-white text-gray-600'}`}>全部</button>
              {categories.map(c => <button key={c.id} onClick={() => setSelectedCat(c.id)} className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium ${selectedCat === c.id ? 'bg-orange-500 text-white' : 'bg-white text-gray-600'}`}>{c.name}</button>)}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {filtered.map(p => {
                const packItem = cart.find(i => i.productId === p.id && i.orderUnit === 'pack')
                const boxItem  = cart.find(i => i.productId === p.id && i.orderUnit === 'box')
                const showPicker = unitPicker === p.id
                return (
                  <div key={p.id} className="bg-white rounded-xl p-3 shadow-sm">
                    <div className="rounded-lg h-28 overflow-hidden bg-orange-50 flex items-center justify-center mb-2">
                      {p.image ? <img src={p.image} alt={p.name} className="w-full h-full object-cover" /> : <span className="text-4xl">{productEmoji(p.categoryId)}</span>}
                    </div>
                    <div className="font-medium text-gray-800 text-sm truncate mb-0.5">{p.name}</div>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {p.subcategory && <span className="text-xs bg-orange-50 text-orange-500 px-1.5 py-0.5 rounded">{p.subcategory}</span>}
                      <span className="text-xs text-gray-400">库存: {p.stock} {p.unit}</span>
                      {p.videoUrl && <a href={p.videoUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline">🎬 视频</a>}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-orange-500">€{p.price.toFixed(2)}</span>
                      {(packItem || boxItem) ? (
                        <div className="flex flex-col gap-1 items-end">
                          {packItem && (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-400">包</span>
                              <button onClick={() => updateQty(p.id, packItem.quantity - 1, 'pack')} className="w-6 h-6 rounded-full bg-orange-100 text-orange-500 font-bold text-sm flex items-center justify-center">-</button>
                              <span className="text-sm w-5 text-center">{packItem.quantity}</span>
                              <button onClick={() => updateQty(p.id, packItem.quantity + 1, 'pack')} className="w-6 h-6 rounded-full bg-orange-500 text-white font-bold text-sm flex items-center justify-center">+</button>
                            </div>
                          )}
                          {boxItem && (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-400">箱</span>
                              <button onClick={() => updateQty(p.id, boxItem.quantity - 1, 'box')} className="w-6 h-6 rounded-full bg-orange-100 text-orange-500 font-bold text-sm flex items-center justify-center">-</button>
                              <span className="text-sm w-5 text-center">{boxItem.quantity}</span>
                              <button onClick={() => updateQty(p.id, boxItem.quantity + 1, 'box')} className="w-6 h-6 rounded-full bg-orange-500 text-white font-bold text-sm flex items-center justify-center">+</button>
                            </div>
                          )}
                        </div>
                      ) : showPicker ? (
                        <div className="flex flex-col gap-1 items-end">
                          <button onClick={() => addToCart(p.id, 'pack')} className="text-xs px-2 py-1 bg-orange-500 text-white rounded-lg font-medium">中包 {p.unit}</button>
                          {p.boxQty && <button onClick={() => addToCart(p.id, 'box')} className="text-xs px-2 py-1 bg-orange-700 text-white rounded-lg font-medium">整箱 {p.boxQty}{p.unit}</button>}
                          <button onClick={() => setUnitPicker(null)} className="text-xs text-gray-400">取消</button>
                        </div>
                      ) : (
                        <button onClick={() => p.boxQty ? setUnitPicker(p.id) : addToCart(p.id, 'pack')} className="w-7 h-7 rounded-full bg-orange-500 text-white text-xl flex items-center justify-center hover:bg-orange-600">+</button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {tab === 'cart' && (
          <div>
            {cart.length === 0 ? <div className="text-center text-gray-400 py-16">购物车为空，去选购吧！</div> : (
              <>
                <div className="space-y-3 mb-4">
                  {cart.map((item, idx) => {
                    const p = products.find(p => p.id === item.productId)
                    if (!p) return null
                    const isBox = item.orderUnit === 'box' && p.boxQty
                    const unitPrice = isBox ? p.price * p.boxQty! : p.price
                    const unitLabel = isBox ? '箱' : p.unit
                    return (
                      <div key={`${item.productId}_${item.orderUnit}_${idx}`} className="bg-white rounded-xl p-3 shadow-sm flex items-center gap-3">
                        <div className="w-14 h-14 rounded-lg overflow-hidden bg-orange-50 flex items-center justify-center shrink-0">
                          {p.image ? <img src={p.image} alt={p.name} className="w-full h-full object-cover" /> : <span className="text-2xl">{productEmoji(p.categoryId)}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-800 truncate">{p.name}</div>
                          <div className="text-sm text-orange-500">€{unitPrice.toFixed(2)} / {unitLabel}{isBox && <span className="text-xs text-gray-400 ml-1">({p.boxQty}{p.unit})</span>}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => updateQty(item.productId, item.quantity - 1, item.orderUnit)} className="w-7 h-7 rounded-full bg-gray-100 font-bold flex items-center justify-center">-</button>
                          <span className="w-6 text-center font-medium">{item.quantity}</span>
                          <button onClick={() => updateQty(item.productId, item.quantity + 1, item.orderUnit)} className="w-7 h-7 rounded-full bg-orange-500 text-white font-bold flex items-center justify-center">+</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
                  <label className="text-sm text-gray-500 block mb-1">备注</label>
                  <textarea value={remark} onChange={e => setRemark(e.target.value)} placeholder="如：请尽快发货…" rows={2} className="w-full border border-gray-100 rounded-lg p-2 text-sm outline-none resize-none" />
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-500">合计</div>
                    <div className="text-xl font-bold text-orange-500">€{cartTotal.toFixed(2)}</div>
                  </div>
                  <button onClick={placeOrder} disabled={placing} className="px-8 py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-60">
                    {placing ? '提交中…' : '提交订单'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'orders' && (
          <div className="space-y-3">
            {orders.length === 0 && <div className="text-center text-gray-400 py-12">暂无订单</div>}
            {orders.map(order => (
              <div key={order.id} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-700">{order.orderNo}</span>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[order.status]}`}>{statusLabel[order.status]}</span>
                </div>
                <div className="text-sm text-gray-500 mb-1">{order.items.map(i => `${i.productName}×${i.quantity}`).join('、')}</div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-300">{new Date(order.createdAt).toLocaleString('zh-CN')}</span>
                  <span className="font-bold text-orange-500">€{order.totalAmount.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex">
        {[{ key: 'shop', label: '选购', icon: '🛍️' }, { key: 'cart', label: `购物车${cart.length > 0 ? `(${cart.length})` : ''}`, icon: '🛒' }, { key: 'orders', label: '我的订单', icon: '📋' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as typeof tab)} className={`flex-1 py-3 flex flex-col items-center gap-0.5 text-xs ${tab === t.key ? 'text-orange-500' : 'text-gray-400'}`}>
            <span className="text-xl">{t.icon}</span><span>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
