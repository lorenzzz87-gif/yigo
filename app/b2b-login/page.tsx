'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { store } from '@/lib/store'

export default function B2BLoginPage() {
  const router = useRouter()
  const [roleHint, setRoleHint] = useState<'buyer' | 'wholesaler' | null>(null)
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [inviteTempPwd, setInviteTempPwd] = useState('')
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const user = store.getCurrentUser()
    if (user) {
      if (user.role === 'buyer') { router.replace('/b2b'); return }
      if (user.role === 'wholesaler') { router.replace('/wholesaler'); return }
    }
    const r = new URLSearchParams(window.location.search).get('role') as 'buyer' | 'wholesaler' | null
    setRoleHint(r)
    setPhone(r === 'buyer' ? '+39 ' : '')
  }, [router])

  async function handleLogin() {
    if (!phone || !password) { setError('Inserisci telefono e password · 请填写手机号和密码'); return }
    setLoading(true); setError('')
    const user = await store.loginByPhone(phone, password)
    setLoading(false)
    if (!user) { setError('Credenziali errate · 手机号或密码错误'); return }
    store.setCurrentUser(user)
    if (user.role === 'buyer') router.push('/b2b')
    else if (user.role === 'wholesaler') router.push('/wholesaler')
    else router.push('/login')
  }

  async function handleRegister() {
    if (!name || !phone || !password) { setError('Compila tutti i campi · 请填写所有字段'); return }
    if (password.length < 6) { setError('Password minimo 6 caratteri · 密码至少6位'); return }
    if (!inviteCode || !inviteTempPwd) { setError('Inserisci il codice fornitore · 请输入批发商给你的商家号'); return }
    setLoading(true); setError('')
    const result = await store.registerBuyer(name, phone, password, inviteCode, inviteTempPwd)
    setLoading(false)
    if (!result.ok) { setError(result.msg); return }
    setSuccess('Registrazione completata! · 注册成功，请登录')
    setMode('login'); setName(''); setInviteCode(''); setInviteTempPwd('')
  }

  const isBuyer = roleHint === 'buyer' || roleHint === null
  const accent = isBuyer ? 'orange' : 'amber'
  const accentClass = isBuyer ? 'bg-orange-500 hover:bg-orange-600' : 'bg-amber-500 hover:bg-amber-600'
  const accentText = isBuyer ? 'text-orange-500' : 'text-amber-500'
  const accentBorder = isBuyer ? 'focus:border-orange-400 focus:ring-orange-100' : 'focus:border-amber-400 focus:ring-amber-100'

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel: brand ── */}
      <div className={`hidden lg:flex w-[520px] shrink-0 flex-col justify-between p-12 ${isBuyer ? 'bg-[#0f172a]' : 'bg-[#1c1008]'}`}>
        <div>
          <img src="/logo.svg" alt="Yigo" className="h-12 w-auto mb-16 brightness-0 invert" />

          <div className="mb-10">
            <div className={`text-xs font-semibold tracking-widest uppercase mb-4 ${isBuyer ? 'text-orange-400' : 'text-amber-400'}`}>
              {roleHint === 'wholesaler' ? 'Portale fornitori · 批发商门户' : 'Portale acquisti · 商家采购门户'}
            </div>
            <h1 className="text-4xl font-bold text-white leading-tight mb-4">
              {roleHint === 'wholesaler'
                ? <>Gestisci il tuo<br />business con Yigo</>
                : <>Ordina con facilità<br />dai tuoi fornitori</>}
            </h1>
            <p className="text-gray-400 text-base leading-relaxed">
              {roleHint === 'wholesaler'
                ? '上架商品、管理订单、邀请客户，一站式批发管理平台。'
                : '浏览批发商商品目录，一键下单，实时跟踪订单状态。'}
            </p>
          </div>

          {/* Feature list */}
          <div className="space-y-4">
            {(roleHint === 'wholesaler' ? [
              '商品目录管理与批量导入',
              '客户邀请码系统',
              '订单跟踪与 Excel 导出',
            ] : [
              '实时浏览批发商完整目录',
              '快速下单，业务员审核',
              '订单历史随时查询',
            ]).map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${isBuyer ? 'bg-orange-500/20' : 'bg-amber-500/20'}`}>
                  <div className={`w-2 h-2 rounded-full ${isBuyer ? 'bg-orange-400' : 'bg-amber-400'}`} />
                </div>
                <span className="text-gray-300 text-sm">{f}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/entry')} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
            ← Torna alla selezione · 返回选择
          </button>
          <span className="text-gray-700 text-xs">yigo.eu</span>
        </div>
      </div>

      {/* ── Right panel: form ── */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="lg:hidden mb-8 text-center">
            <img src="/logo.svg" alt="Yigo" className="h-12 w-auto mx-auto mb-2" />
            <button onClick={() => router.push('/entry')} className={`text-xs ${accentText}`}>← 返回选择身份</button>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="mb-7">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">
                {mode === 'login' ? 'Accedi' : 'Registrati'}
              </h2>
              <p className="text-sm text-gray-400">
                {mode === 'login'
                  ? (roleHint === 'wholesaler' ? '批发商账号登录' : '商家账号登录')
                  : '注册成为商家客户'}
              </p>
            </div>

            {success && (
              <div className="mb-5 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">{success}</div>
            )}
            {error && (
              <div className="mb-5 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</div>
            )}

            <div className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1.5">姓名 / Nome negozio</label>
                  <input value={name} onChange={e => setName(e.target.value)}
                    placeholder="您的姓名或店铺名"
                    className={`w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ${accentBorder} transition`} />
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1.5">Telefono · 手机号</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} type="tel"
                  placeholder="+39 ..."
                  onKeyDown={e => e.key === 'Enter' && mode === 'login' && handleLogin()}
                  className={`w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ${accentBorder} transition`} />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1.5">Password · 密码</label>
                <input value={password} onChange={e => setPassword(e.target.value)} type="password"
                  placeholder={mode === 'register' ? '至少6位' : '请输入密码'}
                  onKeyDown={e => e.key === 'Enter' && mode === 'login' && handleLogin()}
                  className={`w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ${accentBorder} transition`} />
              </div>

              {mode === 'register' && (
                <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-100">
                  <div className="text-xs text-gray-500 font-medium">向批发商索取的商家号 + 临时密码</div>
                  <input value={inviteCode} onChange={e => setInviteCode(e.target.value)}
                    placeholder="商家号，如 M123456"
                    className={`w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 ${accentBorder} bg-white transition`} />
                  <input value={inviteTempPwd} onChange={e => setInviteTempPwd(e.target.value)}
                    placeholder="临时密码"
                    className={`w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 ${accentBorder} bg-white transition`} />
                </div>
              )}
            </div>

            <button onClick={mode === 'login' ? handleLogin : handleRegister}
              disabled={loading}
              className={`w-full mt-6 py-3.5 text-white font-semibold rounded-xl text-sm ${accentClass} disabled:opacity-50 transition-colors`}>
              {loading ? 'Caricamento… · 请稍候' : mode === 'login' ? 'Accedi · 登录' : 'Registrati · 注册'}
            </button>

            {/* Mode switch — only show register for buyers */}
            {roleHint !== 'wholesaler' && (
              <div className="mt-5 text-center text-sm text-gray-400">
                {mode === 'login' ? (
                  <>Prima volta? <button onClick={() => { setMode('register'); setError('') }} className={`font-medium ${accentText}`}>Registrati · 注册</button></>
                ) : (
                  <>Hai già un account? <button onClick={() => { setMode('login'); setError('') }} className={`font-medium ${accentText}`}>Accedi · 登录</button></>
                )}
              </div>
            )}

            <div className="mt-6 pt-5 border-t border-gray-100 text-center text-xs text-gray-300">
              批发商/业务员账号请联系平台开通 · Per account fornitori contattare la piattaforma
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
