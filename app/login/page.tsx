'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { store } from '@/lib/store'

const DEMO_ACCOUNTS = [
  { label: '管理员', role: 'admin', phone: '13800000001', password: '123456', icon: '👑', color: 'bg-purple-50 border-purple-200 text-purple-700' },
  { label: '业务员', role: 'salesperson', phone: '13800000004', password: '123456', icon: '💼', color: 'bg-green-50 border-green-200 text-green-700' },
  { label: '采购商A', role: 'buyer', phone: '13800000002', password: '123456', icon: '🏪', color: 'bg-blue-50 border-blue-200 text-blue-700' },
  { label: '采购商B', role: 'buyer', phone: '13800000003', password: '123456', icon: '🏪', color: 'bg-blue-50 border-blue-200 text-blue-700' },
]

export default function LoginPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [phone, setPhone] = useState('+39 ')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleLogin() {
    if (!phone || !password) { setError('请填写手机号和密码'); return }
    setLoading(true); setError('')
    const user = await store.loginByPhone(phone, password)
    setLoading(false)
    if (!user) { setError('手机号或密码错误'); return }
    store.setCurrentUser(user)
    router.push(`/${user.role}`)
  }

  async function handleRegister() {
    if (!name || !phone || !password) { setError('请填写所有字段'); return }
    if (phone.trim().length < 6) { setError('请输入正确的手机号'); return }
    if (password.length < 6) { setError('密码至少6位'); return }
    setLoading(true); setError('')
    const result = await store.registerBuyer(name, phone, password)
    setLoading(false)
    if (!result.ok) { setError(result.msg); return }
    setSuccess('注册成功！请登录')
    setTab('login')
    setName('')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <img src="/logo.svg" alt="Yigo 易购" className="h-16 w-auto mx-auto mb-2" />
          <div className="text-gray-400 text-sm">意大利华人B2B订货平台</div>
        </div>

        <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
          {(['login', 'register'] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setError(''); setSuccess('') }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tab === t ? 'bg-white shadow text-orange-500' : 'text-gray-400'}`}>
              {t === 'login' ? '登录' : '注册'}
            </button>
          ))}
        </div>

        {success && <div className="mb-4 text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2">{success}</div>}
        {error && <div className="mb-4 text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

        <div className="space-y-3">
          {tab === 'register' && (
            <div>
              <label className="text-sm text-gray-500 block mb-1">姓名 / 店铺名</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="请输入姓名"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400" />
            </div>
          )}
          <div>
            <label className="text-sm text-gray-500 block mb-1">手机号</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="请输入手机号" type="tel"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400" />
          </div>
          <div>
            <label className="text-sm text-gray-500 block mb-1">密码</label>
            <input value={password} onChange={e => setPassword(e.target.value)} placeholder={tab === 'register' ? '至少6位' : '请输入密码'} type="password"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400" />
          </div>
        </div>

        <button onClick={tab === 'login' ? handleLogin : handleRegister} disabled={loading}
          className="w-full mt-6 py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-50 transition-colors">
          {loading ? '请稍候…' : tab === 'login' ? '登录' : '注册账号'}
        </button>

        {tab === 'login' && (
          <p className="text-center text-xs text-gray-400 mt-4">
            管理员/业务员账号请联系平台
          </p>
        )}

        {/* 测试快速入口 */}
        <div className="mt-6 pt-5 border-t border-gray-100">
          <p className="text-xs text-gray-300 text-center mb-3">— 测试快速登录 —</p>
          <div className="grid grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map(acc => (
              <button key={acc.phone} onClick={async () => {
                const user = await store.loginByPhone(acc.phone, acc.password)
                if (user) { store.setCurrentUser(user); router.push(`/${user.role}`) }
              }}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all hover:opacity-80 ${acc.color}`}>
                <span>{acc.icon}</span>
                <span>{acc.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
