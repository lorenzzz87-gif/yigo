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
  const [selectedCat, setSelectedCat] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState(store.getCart())
  const [remark, setRemark] = useState('')
  const [orders, setOrders] = useState(store.getOrders())
  const [toast, setToast] = useState('')

  useEffect(() => {
    const u = store.getCurrentUser()
    if (!u || u.role !== 'buyer') { router.replace('/login'); return }
    setUser(u)
    setProducts(store.getProducts())
    setCategories(store.getCategories())
    setOrders(store.getOrdersByBuyer(u.id))
  }, [router])

  function refreshCart() { setCart(store.getCart()) }

  function addToCart(productId: string) {
    store.addToCart(productId, 1)
    refreshCart()
    showToast('已加入购物车')
  }

  function updateQty(productId: string, qty: number) {
    store.updateCartItem(productId, qty)
    refreshCart()
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
  }

  function placeOrder() {
    if (!user || cart.length === 0) return
    store.createOrder(user.id, user.name, cart, remark)
    setCart([])
    setRemark('')
    setOrders(store.getOrdersByBuyer(user.id))
    setTab('orders')
    showToast('下单成功！')
  }

  function productEmoji(categoryId: string) {
    const map: Record<string, string> = { c1: '🥤', c2: '🍟', c3: '🧴', c4: '🌾' }
    return map[categoryId] || '📦'
  }

  const filtered = products.filter(p => {
    const matchCat = selectedCat === 'all' || p.categoryId === selectedCat
    const matchSearch = !search || p.name.includes(search)
    return matchCat && matchSearch
  })

  const cartTotal = cart.reduce((sum, item) => {
    const p = products.find(p => p.id === item.productId)
    return sum + (p?.price || 0) * item.quantity
  }, 0)

  const statusColor: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    confirmed: 'bg-blue-100 text-blue-700',
    shipped: 'bg-purple-100 text-purple-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-gray-100 text-gray-500',
  }
  const statusLabel: Record<string, string> = { pending: '待确认', confirmed: '已确认', shipped: '已发货', completed: '已完成', cancelled: '已取消' }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navbar user={user} title="采购下单" />

      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-sm px-4 py-2 rounded-full z-50 shadow">{toast}</div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-4">
        {tab === 'shop' && (
          <div>
            <div className="flex gap-2 mb-3">
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索商品…" className="flex-1 border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400" />
            </div>
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
              <button onClick={() => setSelectedCat('all')} className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedCat === 'all' ? 'bg-orange-500 text-white' : 'bg-white text-gray-600'}`}>全部</button>
              {categories.map(c => (
                <button key={c.id} onClick={() => setSelectedCat(c.id)} className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedCat === c.id ? 'bg-orange-500 text-white' : 'bg-white text-gray-600'}`}>{c.name}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {filtered.map(p => {
                const inCart = cart.find(i => i.productId === p.id)
                return (
                  <div key={p.id} className="bg-white rounded-xl p-3 shadow-sm">
                    {/* Product image */}
                    <div className="rounded-lg h-28 overflow-hidden bg-orange-50 flex items-center justify-center mb-2">
                      {p.image ? (
                        <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-4xl">{productEmoji(p.categoryId)}</span>
                      )}
                    </div>
                    <div className="font-medium text-gray-800 text-sm mb-0.5 truncate">{p.name}</div>
                    <div className="text-xs text-gray-400 mb-2">库存: {p.stock} {p.unit}</div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-orange-500">¥{p.price.toFixed(2)}</span>
                      {inCart ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => updateQty(p.id, inCart.quantity - 1)} className="w-6 h-6 rounded-full bg-orange-100 text-orange-500 font-bold text-sm flex items-center justify-center">-</button>
                          <span className="text-sm w-5 text-center">{inCart.quantity}</span>
                          <button onClick={() => updateQty(p.id, inCart.quantity + 1)} className="w-6 h-6 rounded-full bg-orange-500 text-white font-bold text-sm flex items-center justify-center">+</button>
                        </div>
                      ) : (
                        <button onClick={() => addToCart(p.id)} className="w-7 h-7 rounded-full bg-orange-500 text-white text-xl flex items-center justify-center hover:bg-orange-600">+</button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            {filtered.length === 0 && <div className="text-center text-gray-400 py-12">暂无商品</div>}
          </div>
        )}

        {tab === 'cart' && (
          <div>
            {cart.length === 0 ? (
              <div className="text-center text-gray-400 py-16">购物车为空，去选购吧！</div>
            ) : (
              <>
                <div className="space-y-3 mb-4">
                  {cart.map(item => {
                    const p = products.find(p => p.id === item.productId)
                    if (!p) return null
                    return (
                      <div key={item.productId} className="bg-white rounded-xl p-3 shadow-sm flex items-center gap-3">
                        <div className="w-14 h-14 rounded-lg overflow-hidden bg-orange-50 flex items-center justify-center shrink-0">
                          {p.image ? (
                            <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-2xl">{productEmoji(p.categoryId)}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-800 truncate">{p.name}</div>
                          <div className="text-sm text-orange-500">¥{p.price.toFixed(2)} / {p.unit}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => updateQty(item.productId, item.quantity - 1)} className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 font-bold flex items-center justify-center">-</button>
                          <span className="w-6 text-center font-medium">{item.quantity}</span>
                          <button onClick={() => updateQty(item.productId, item.quantity + 1)} className="w-7 h-7 rounded-full bg-orange-500 text-white font-bold flex items-center justify-center">+</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
                  <label className="text-sm text-gray-500 block mb-1">备注</label>
                  <textarea value={remark} onChange={e => setRemark(e.target.value)} placeholder="如：请尽快发货…" rows={2} className="w-full border border-gray-100 rounded-lg p-2 text-sm outline-none focus:border-orange-400 resize-none" />
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-500">合计</div>
                    <div className="text-xl font-bold text-orange-500">¥{cartTotal.toFixed(2)}</div>
                  </div>
                  <button onClick={placeOrder} className="px-8 py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600">提交订单</button>
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
                  <span className="font-bold text-orange-500">¥{order.totalAmount.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex">
        {[
          { key: 'shop', label: '选购', icon: '🛍️' },
          { key: 'cart', label: `购物车${cart.length > 0 ? `(${cart.length})` : ''}`, icon: '🛒' },
          { key: 'orders', label: '我的订单', icon: '📋' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as typeof tab)} className={`flex-1 py-3 flex flex-col items-center gap-0.5 text-xs transition-colors ${tab === t.key ? 'text-orange-500' : 'text-gray-400'}`}>
            <span className="text-xl">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
