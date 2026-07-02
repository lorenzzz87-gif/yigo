'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, ClipboardCheck, ClipboardList, ShoppingCart, Check } from 'lucide-react'
import { store, User, Order, Product, getStatusLabel } from '@/lib/store'
import Navbar from '@/components/navbar'

export default function SalespersonPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [filterStatus, setFilterStatus] = useState('pending_review')
  const [tab, setTab] = useState<'review' | 'orders' | 'placeOrder'>('review')
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState(store.getCart())
  const [buyers, setBuyers] = useState<User[]>([])
  const [selectedBuyer, setSelectedBuyer] = useState('')
  const [toast, setToast] = useState('')
  const [placing, setPlacing] = useState(false)
  const [actioningId, setActioningId] = useState<string | null>(null)
  const [wid, setWid] = useState('')

  useEffect(() => {
    const u = store.getCurrentUser()
    if (!u || u.role !== 'salesperson') { router.replace('/login'); return }
    if (!u.wholesalerId) { router.replace('/login'); return }
    setUser(u); setWid(u.wholesalerId)
    loadData(u.wholesalerId)
  }, [router])

  async function loadData(w: string) {
    const [o, p, users] = await Promise.all([store.getOrders(w), store.getProducts(w), store.getUsers()])
    setOrders(o); setProducts(p)
    const b = users.filter(u => u.role === 'buyer' && u.wholesalerId === w)
    setBuyers(b); if (b[0]) setSelectedBuyer(b[0].id)
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2500) }
  function refreshCart() { setCart(store.getCart()) }
  function addToCart(productId: string) { store.addToCart(productId, 1); refreshCart() }
  function updateQty(productId: string, qty: number) { store.updateCartItem(productId, qty); refreshCart() }

  async function handleReview(orderId: string, approve: boolean) {
    setActioningId(orderId)
    await store.updateOrderStatus(orderId, approve ? 'pending' : 'cancelled')
    await loadData(wid)
    setActioningId(null)
    showToast(approve ? '已通过，订单已转交批发商' : '已拒绝该订单')
  }

  async function placeOrderForBuyer() {
    if (!selectedBuyer || cart.length === 0 || !user) return
    const buyer = buyers.find(b => b.id === selectedBuyer)!
    setPlacing(true)
    await store.createOrder(buyer.id, buyer.name, cart, products, wid, '', user.id)
    setCart([])
    await loadData(wid)
    setTab('review')
    showToast(`已为 ${buyer.name} 下单`)
    setPlacing(false)
  }

  const pendingReview = orders.filter(o => o.status === 'pending_review')
  const otherOrders = orders.filter(o => filterStatus === 'all' ? o.status !== 'pending_review' : o.status === filterStatus)
  const cartTotal = cart.reduce((sum, item) => sum + (products.find(p => p.id === item.productId)?.price || 0) * item.quantity, 0)
  const myOrderCount = orders.filter(o => o.salesId === user?.id).length
  const myRevenue = orders.filter(o => o.salesId === user?.id && !['cancelled', 'pending_review'].includes(o.status)).reduce((s, o) => s + o.totalAmount, 0)
  const commissionRate = user?.commissionRate || 0
  const myCommission = myRevenue * commissionRate

  const statusColor: Record<string, string> = {
    pending_review: 'bg-orange-100 text-orange-700',
    pending: 'bg-yellow-100 text-yellow-700',
    confirmed: 'bg-blue-100 text-blue-700',
    shipped: 'bg-purple-100 text-purple-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-gray-100 text-gray-500',
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navbar user={user} title="业务员工作台" />
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-sm px-4 py-2 rounded-full z-50 shadow flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-400" strokeWidth={1.75} />
          {toast}
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-xl font-bold text-blue-600">{myOrderCount}</div>
            <div className="text-gray-400 text-sm">我的订单数</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-xl font-bold text-green-600">€{myRevenue.toFixed(0)}</div>
            <div className="text-gray-400 text-sm">累计销售额</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-xl font-bold text-orange-500">€{myCommission.toFixed(0)}</div>
            <div className="text-gray-400 text-sm">我的佣金 ({(commissionRate * 100).toFixed(0)}%)</div>
          </div>
        </div>

        {/* 审核订单 tab */}
        {tab === 'review' && (
          <div>
            {pendingReview.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-6 h-6 text-green-400" strokeWidth={1.5} />
                </div>
                <div className="text-gray-400 text-sm">暂无待审核订单</div>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingReview.map(order => (
                  <div key={order.id} className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-orange-400">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-semibold text-gray-800">{order.orderNo}</div>
                        <div className="text-sm text-gray-500 mt-0.5">客户：{order.buyerName}</div>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-full font-medium bg-orange-100 text-orange-700">待审核</span>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-3 mb-3">
                      <div className="text-xs text-gray-400 mb-1">订单明细</div>
                      {order.items.map((i, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-gray-700">{i.productName} × {i.quantity}{i.unit}</span>
                          <span className="text-gray-500">€{(i.price * i.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleString('zh-CN')}</span>
                        {order.remark && <div className="text-xs text-gray-400 mt-0.5">备注：{order.remark}</div>}
                      </div>
                      <span className="font-bold text-orange-500 text-lg">€{order.totalAmount.toFixed(2)}</span>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => handleReview(order.id, false)}
                        disabled={actioningId === order.id}
                        className="flex-1 py-2.5 border-2 border-red-200 text-red-500 rounded-xl text-sm font-medium hover:bg-red-50 disabled:opacity-50 transition-colors"
                      >
                        拒绝
                      </button>
                      <button
                        onClick={() => handleReview(order.id, true)}
                        disabled={actioningId === order.id}
                        className="flex-1 py-2.5 bg-green-500 text-white rounded-xl text-sm font-medium hover:bg-green-600 disabled:opacity-50 transition-colors"
                      >
                        {actioningId === order.id ? '处理中…' : '通过 → 转给批发商'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 所有订单 tab */}
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
              {otherOrders.length === 0 && <div className="text-center text-gray-400 py-12">暂无订单</div>}
              {otherOrders.map(order => (
                <div key={order.id} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-semibold text-gray-800">{order.orderNo}</div>
                      <div className="text-sm text-gray-400">{order.buyerName}</div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[order.status]}`}>{getStatusLabel(order.status)}</span>
                  </div>
                  <div className="text-sm text-gray-500 mb-2">{order.items.map(i => `${i.productName}×${i.quantity}`).join('、')}</div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleString('zh-CN')}</span>
                    <span className="font-bold text-orange-500">€{order.totalAmount.toFixed(2)}</span>
                  </div>
                  {order.salesId === user.id && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-green-500">
                      <Check className="w-3 h-3" strokeWidth={2.5} />
                      本人开单
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 代客下单 tab */}
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
                    <div className="text-xs text-gray-400 mb-2">€{p.price} / {p.unit}</div>
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
                <div>
                  <div className="text-sm text-gray-500">{cart.length} 种商品</div>
                  <div className="text-xl font-bold text-orange-500">€{cartTotal.toFixed(2)}</div>
                </div>
                <button onClick={placeOrderForBuyer} disabled={placing} className="px-6 py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-60">
                  {placing ? '下单中…' : '代客下单'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex">
        {[
          { key: 'review', label: `待审核${pendingReview.length > 0 ? `(${pendingReview.length})` : ''}`, icon: ClipboardCheck },
          { key: 'orders', label: '订单记录', icon: ClipboardList },
          { key: 'placeOrder', label: '代客下单', icon: ShoppingCart },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as typeof tab)} className={`flex-1 py-3 flex flex-col items-center gap-1 text-xs transition-colors ${tab === t.key ? 'text-orange-500' : 'text-gray-400'}`}>
            <t.icon className="w-5 h-5" strokeWidth={tab === t.key ? 2 : 1.75} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
