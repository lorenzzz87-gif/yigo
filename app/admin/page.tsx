'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Store, CheckCircle2, Euro, Users } from 'lucide-react'
import { store, User, Order, Product, Wholesaler } from '@/lib/store'
import Navbar from '@/components/navbar'

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [wholesalers, setWholesalers] = useState<Wholesaler[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', contact: '', phone: '', password: '' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => {
    const u = store.getCurrentUser()
    if (!u || u.role !== 'admin') { router.replace('/login'); return }
    setUser(u)
    refreshData()
  }, [router])

  async function refreshData() {
    const [w, o, p, us] = await Promise.all([store.getWholesalers(), store.getOrders(), store.getProducts(), store.getUsers()])
    setWholesalers(w); setOrders(o); setProducts(p); setUsers(us)
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  async function createWholesaler() {
    if (!form.name || !form.phone || !form.password) { setFormError('请填写批发商名称、登录手机号、密码'); return }
    if (form.password.length < 6) { setFormError('密码至少6位'); return }
    setSaving(true); setFormError('')
    const res = await store.addWholesaler(form.name, form.contact, form.phone, form.password)
    setSaving(false)
    if (!res.ok) { setFormError(res.msg); return }
    setShowForm(false)
    setForm({ name: '', contact: '', phone: '', password: '' })
    await refreshData()
    showToast('批发商已开通！')
  }

  async function toggleStatus(w: Wholesaler) {
    const next = w.status === 'active' ? 'suspended' : 'active'
    if (!confirm(next === 'suspended' ? `确认停用「${w.name}」？停用后该批发商无法登录。` : `确认恢复「${w.name}」？`)) return
    await store.updateWholesalerStatus(w.id, next)
    await refreshData()
    showToast(next === 'suspended' ? '已停用' : '已恢复')
  }

  function statsFor(wid: string) {
    const wOrders = orders.filter(o => o.wholesalerId === wid && o.status !== 'pending_review')
    return {
      orders: wOrders.length,
      revenue: wOrders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.totalAmount, 0),
      products: products.filter(p => p.wholesalerId === wid).length,
      salespeople: users.filter(u => u.wholesalerId === wid && u.role === 'salesperson').length,
      buyers: users.filter(u => u.wholesalerId === wid && u.role === 'buyer').length,
    }
  }

  const platform = {
    wholesalers: wholesalers.length,
    active: wholesalers.filter(w => w.status === 'active').length,
    totalRevenue: orders.filter(o => !['cancelled', 'pending_review'].includes(o.status)).reduce((s, o) => s + o.totalAmount, 0),
    totalBuyers: users.filter(u => u.role === 'buyer').length,
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} title="平台管理" />
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-sm px-4 py-2 rounded-full z-50 shadow flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-400" strokeWidth={1.75} />
          {toast}
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: '批发商总数', value: platform.wholesalers, color: 'text-blue-600', icon: Store, iconBg: 'bg-blue-50' },
            { label: '运营中', value: platform.active, color: 'text-green-600', icon: CheckCircle2, iconBg: 'bg-green-50' },
            { label: '平台总营收', value: `€${platform.totalRevenue.toFixed(0)}`, color: 'text-orange-500', icon: Euro, iconBg: 'bg-orange-50' },
            { label: '终端商家', value: platform.totalBuyers, color: 'text-purple-600', icon: Users, iconBg: 'bg-purple-50' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.iconBg} ${s.color}`}>
                  <s.icon className="w-4 h-4" strokeWidth={1.75} />
                </div>
              </div>
              <div className="text-gray-400 text-sm mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-700">批发商账号</h2>
          <button onClick={() => { setShowForm(true); setFormError('') }} className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors">
            <Plus className="w-4 h-4" strokeWidth={2} />
            开通批发商
          </button>
        </div>

        <div className="space-y-3">
          {wholesalers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                <Store className="w-6 h-6 text-gray-300" strokeWidth={1.5} />
              </div>
              <div className="text-gray-400 text-sm">还没有批发商，点击右上角开通</div>
            </div>
          )}
          {wholesalers.map(w => {
            const s = statsFor(w.id)
            return (
              <div key={w.id} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800">{w.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${w.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {w.status === 'active' ? '运营中' : '已停用'}
                    </span>
                  </div>
                  <button onClick={() => toggleStatus(w)} className={`text-xs px-3 py-1 rounded-lg font-medium ${w.status === 'active' ? 'border border-red-200 text-red-500 hover:bg-red-50' : 'bg-green-500 text-white hover:bg-green-600'}`}>
                    {w.status === 'active' ? '停用' : '恢复'}
                  </button>
                </div>
                {w.contact && <div className="text-xs text-gray-400 mb-3">联系方式：{w.contact}</div>}
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="bg-gray-50 rounded-lg py-2">
                    <div className="font-bold text-gray-700">{s.orders}</div>
                    <div className="text-xs text-gray-400">订单</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg py-2">
                    <div className="font-bold text-orange-500">€{s.revenue.toFixed(0)}</div>
                    <div className="text-xs text-gray-400">营收</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg py-2">
                    <div className="font-bold text-gray-700">{s.products}</div>
                    <div className="text-xs text-gray-400">商品</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg py-2">
                    <div className="font-bold text-gray-700">{s.buyers}<span className="text-xs text-gray-400">/{s.salespeople}</span></div>
                    <div className="text-xs text-gray-400">商家/业务</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="font-bold text-gray-800 mb-4">开通新批发商</h3>
            {formError && <div className="mb-3 text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{formError}</div>}
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-500 mb-1 block">批发商名称 *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="如：罗马食品批发" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
              </div>
              <div>
                <label className="text-sm text-gray-500 mb-1 block">联系方式</label>
                <input value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} placeholder="电话 / 地址（选填）" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
              </div>
              <div className="border-t border-gray-100 pt-3">
                <div className="text-xs text-gray-400 mb-2">批发商登录账号</div>
                <label className="text-sm text-gray-500 mb-1 block">登录手机号 *</label>
                <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="批发商用此号登录" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400 mb-3" />
                <label className="text-sm text-gray-500 mb-1 block">初始密码 *</label>
                <input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="至少6位" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 border border-gray-200 rounded-xl text-gray-600 text-sm hover:bg-gray-50">取消</button>
              <button onClick={createWholesaler} disabled={saving} className="flex-1 py-2 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 disabled:opacity-60">
                {saving ? '开通中…' : '开通'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
