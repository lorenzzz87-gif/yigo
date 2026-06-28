'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { store } from '@/lib/store'

const DEMO_ACCOUNTS = [
  { label: '平台管理员', role: 'admin', phone: '13800000001', password: '123456', icon: '👑', color: 'bg-purple-50 border-purple-200 text-purple-700' },
  { label: '批发商', role: 'wholesaler', phone: '13900000001', password: '123456', icon: '🏬', color: 'bg-amber-50 border-amber-200 text-amber-700' },
  { label: '业务员', role: 'salesperson', phone: '13800000004', password: '123456', icon: '💼', color: 'bg-green-50 border-green-200 text-green-700' },
  { label: '商家A', role: 'buyer', phone: '13800000002', password: '123456', icon: '🏪', color: 'bg-blue-50 border-blue-200 text-blue-700' },
  { label: '商家B', role: 'buyer', phone: '13800000003', password: '123456', icon: '🏪', color: 'bg-blue-50 border-blue-200 text-blue-700' },
]

export default function LoginPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [phone, setPhone] = useState('+39 ')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [inviteTempPwd, setInviteTempPwd] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  function destFor(role: string) {
    // Buyers on the b2b.* subdomain or a desktop screen → Italian B2B portal; phones → mobile portal
    if (role === 'buyer' && typeof window !== 'undefined') {
      const isB2BHost = window.location.hostname.startsWith('b2b.')
      if (isB2BHost || window.innerWidth >= 1024) return '/b2b'
    }
    return `/${role}`
  }

  async function handleLogin() {
    if (!phone || !password) { setError('请填写手机号和密码'); return }
    setLoading(true); setError('')
    const user = await store.loginByPhone(phone, password)
    setLoading(false)
    if (!user) { setError('手机号或密码错误'); return }
    store.setCurrentUser(user)
    router.push(destFor(user.role))
  }

  async function handleRegister() {
    if (!name || !phone || !password) { setError('请填写姓名、手机号、密码'); return }
    if (phone.trim().length < 6) { setError('请输入正确的手机号'); return }
    if (password.length < 6) { setError('密码至少6位'); return }
    if (!inviteCode || !inviteTempPwd) { setError('请输入批发商给你的商家号和临时密码'); return }
    setLoading(true); setError('')
    const result = await store.registerBuyer(name, phone, password, inviteCode, inviteTempPwd)
    setLoading(false)
    if (!result.ok) { setError(result.msg); return }
    setSuccess('订阅成功！已成为该批发商客户，请登录')
    setTab('login')
    setName(''); setInviteCode(''); setInviteTempPwd('')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100 py-8">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <img src="/logo.svg" alt="Yigo 易购" className="h-16 w-auto mx-auto mb-2" />
          <div className="text-gray-400 text-sm">意大利华人B2B订货平台</div>
        </div>

        <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
          {(['login', 'register'] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setError(''); setSuccess('') }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tab === t ? 'bg-white shadow text-orange-500' : 'text-gray-400'}`}>
              {t === 'login' ? '登录' : '商家注册'}
            </button>
          ))}
        </div>

        {success && <div className="mb-4 text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2">{success}</div>}
        {error && <div className="mb-4 text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

        <div className="space-y-3">
          {tab === 'register' && (
            <>
              <div>
                <label className="text-sm text-gray-500 block mb-1">姓名 / 店铺名</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="请输入姓名"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base outline-none focus:border-orange-400" />
              </div>
              <div className="bg-orange-50 rounded-xl p-3 space-y-2">
                <div className="text-xs text-orange-600">⬇ 向批发商索取的商家号 + 临时密码（2天内有效）</div>
                <input value={inviteCode} onChange={e => setInviteCode(e.target.value)} placeholder="商家号，如 M123456"
                  className="w-full border border-orange-200 rounded-xl px-4 py-3 text-base outline-none focus:border-orange-400 bg-white" />
                <input value={inviteTempPwd} onChange={e => setInviteTempPwd(e.target.value)} placeholder="临时密码"
                  className="w-full border border-orange-200 rounded-xl px-4 py-3 text-base outline-none focus:border-orange-400 bg-white" />
              </div>
            </>
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
            批发商/业务员账号请联系平台开通
          </p>
        )}

        {/* 测试快速入口 */}
        <div className="mt-6 pt-5 border-t border-gray-100">
          <p className="text-xs text-gray-300 text-center mb-3">— 测试快速登录 —</p>
          <div className="grid grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map(acc => (
              <button key={acc.phone} onClick={async () => {
                const user = await store.loginByPhone(acc.phone, acc.password)
                if (user) { store.setCurrentUser(user); router.push(destFor(user.role)) }
                else setError('该测试账号尚未在数据库创建')
              }}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all hover:opacity-80 ${acc.color}`}>
                <span>{acc.icon}</span>
                <span>{acc.label}</span>
              </button>
            ))}
          </div>

          <button onClick={async () => {
            const user = await store.loginByPhone('13800000002', '123456')
            if (user) { store.setCurrentUser(user); router.push('/b2b') }
            else setError('该测试账号尚未在数据库创建')
          }}
            className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-all">
            <span>🇮🇹</span>
            <span>B2B 电脑版入口（意大利语）</span>
          </button>
        </div>
      </div>
    </div>
  )
}
