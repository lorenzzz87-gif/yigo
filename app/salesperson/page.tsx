'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { store, User, Order, Product, getStatusLabel } from '@/lib/store'
import Navbar from '@/components/navbar'

export default function SalespersonPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [filterStatus, setFilterStatus] = useState('all')
  const [tab, setTab] = useState<'orders' | 'placeOrder'>('orders')
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState(store.getCart())
  const [buyers, setBuyers] = useState<User[]>([])
  const [selectedBuyer, setSelectedBuyer] = useState('')
  const [toast, setToast] = useState('')
  const [placing, setPlacing] = useState(false)

  useEffect(() => {
    const u = store.getCurrentUser()
    if (!u || u.role !== 'salesperson') { router.replace('/login'); return }
    setUser(u)
    Promise.all([store.getOrders(), store.getProducts(), store.getUsers()]).then(([o, p, users]) => {
      setOrders(o); setProducts(p)
      const b = users.filter(u => u.role === 'buyer')
      setBuyers(b); if (b[0]) setSelectedBuyer(b[0].id)
    })
  }, [router])

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2000) }
  function refreshCart() { setCart(store.getCart()) }
  function addToCart(productId: string) { store.addToCart(productId, 1); refreshCart() }
  function updateQty(productId: string, qty: number) { store.updateCartItem(productId, qty); refreshCart() }

  async function placeOrderForBuyer() {
    if (!selectedBuyer || cart.length === 0 || !user) return
    const buyer = buyers.find(b => b.id === selectedBuyer)!
    setPlacing(true)
    await store.createOrder(buyer.id, buyer.name, cart, products, '', user.id)
    setCart([])
    const o = await store.getOrders()
    setOrders(o); setTab('orders')
    showToast(`已为 ${buyer.name} 下单`)
    setPlacing(false)
  }

  const filtered = orders.filter(o => filterStatus === 'all' || o.status === filterStatus)
  const cartTotal = cart.reduce((sum, item) => sum + (products.find(p => p.id === item.productId)?.price || 0) * item.quantity, 0)
  const myOrderCount = orders.filter(o => o.salesId === user?.id).length
  const myRevenue = orders.filter(o => o.salesId === user?.id && o.status !== 'cancelled').reduce((s, o) => s + o.totalAmount, 0)

  const statusColor: Record<string, string> = { pending: 'bg-yellow-100 text-yellow-700', confirmed: 'bg-blue-100 text-blue-700', shipped: 'bg-purple-100 text-purple-700', completed: 'bg-green-100 text-green-700', cancelled: 'bg-gray-100 text-gray-500' }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navbar user={user} title="业务员工作台" />
      {toast && <div className="fixed top-16 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-sm px-4 py-2 rounded-full z-50">{toast}</div>}
      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white rounded-xl p-4 shadow-sm"><div className="text-xl font-bold text-blue-600">{myOrderCount}</div><div className="text-gray-400 text-sm">我的订单数</div></div>
          <div className="bg-white rounded-xl p-4 shadow-sm"><div className="text-xl font-bold text-green-600">¥{myRevenue.toFixed(0)}</div><div className="text-gray-400 text-sm">累计销售额</div></div>
        </div>

        {tab === 'orders' && (
          <div>
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
              {['all', 'pending', 'confirmed', 'shipped', 'completed', 'cancelled'].map(s => (
                <button key={s} onClick={() => setFilterStatus(s)} className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium ${filterStatus === s ? 'bg-orange-500 text-white' : 'bg-white text-gray-500'}`}>
                  {s === 'all' ? '全部' : getStatusLabel(s as Order['status'])}
                </button>
              ))}
            </div>
            <div className="space-y-3">
              {filtered.length === 0 && <div className="text-center text-gray-400 py-12">暂无订单</div>}
              {filtered.map(order => (
                <div key={order.id} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div><div className="font-semibold text-gray-800">{order.orderNo}</div><div className="text-sm text-gray-400">{order.buyerName}</div></div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[order.status]}`}>{getStatusLabel(order.status)}</span>
                  </div>
                  <div className="text-sm text-gray-500 mb-2">{order.items.map(i => `${i.productName}×${i.quantity}`).join('、')}</div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-300">{new Date(order.createdAt).toLocaleString('zh-CN')}</span>
                    <span className="font-bold text-orange-500">¥{order.totalAmount.toFixed(2)}</span>
                  </div>
                  {order.salesId === user.id && <div className="mt-1 text-xs text-green-500">✓ 本人开单</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'placeOrder' && (
          <div>
            <div className="bg-white rounded-xl p-4 shadow-sm mb-3">
              <label className="text-sm text-gray-500 block mb-1">为客户下单</label>
              <select value={selectedBuyer} onChange={e => setSelectedBuyer(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400">
                {buyers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {products.map(p => {
                const inCart = cart.find(i => i.productId === p.id)
                return (
                  <div key={p.id} className="bg-white rounded-xl p-3 shadow-sm">
                    <div className="font-medium text-gray-800 text-sm truncate mb-0.5">{p.name}</div>
                    <div className="text-xs text-gray-400 mb-2">¥{p.price} / {p.unit}</div>
                    {inCart ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateQty(p.id, inCart.quantity - 1)} className="w-6 h-6 rounded-full bg-gray-100 font-bold text-sm flex items-center justify-center">-</button>
                        <span className="text-sm w-5 text-center">{inCart.quantity}</span>
                        <button onClick={() => updateQty(p.id, inCart.quantity + 1)} className="w-6 h-6 rounded-full bg-orange-500 text-white font-bold text-sm flex items-center justify-center">+</button>
                      </div>
                    ) : (
                      <button onClick={() => addToCart(p.id)} className="text-xs bg-orange-500 text-white px-3 py-1 rounded-lg hover:bg-orange-600">+ 加入</button>
                    )}
                  </div>
                )
              })}
            </div>
            {cart.length > 0 && (
              <div className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between">
                <div><div className="text-sm text-gray-500">{cart.length} 种商品</div><div className="text-xl font-bold text-orange-500">¥{cartTotal.toFixed(2)}</div></div>
                <button onClick={placeOrderForBuyer} disabled={placing} className="px-6 py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-60">
                  {placing ? '下单中…' : '代客下单'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex">
        {[{ key: 'orders', label: '订单列表', icon: '📋' }, { key: 'placeOrder', label: '代客下单', icon: '🛒' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as typeof tab)} className={`flex-1 py-3 flex flex-col items-center gap-0.5 text-xs ${tab === t.key ? 'text-orange-500' : 'text-gray-400'}`}>
            <span className="text-xl">{t.icon}</span><span>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
