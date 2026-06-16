'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { store, User } from '@/lib/store'

export default function LoginPage() {
  const router = useRouter()
  const [selected, setSelected] = useState<string>('')
  const [users, setUsers] = useState<User[]>([])

  useEffect(() => {
    store.getUsers().then(setUsers)
  }, [])

  function login() {
    const user = users.find(u => u.id === selected)
    if (!user) return
    store.setCurrentUser(user)
    router.push(`/${user.role}`)
  }

  const roleLabel: Record<string, string> = { admin: '管理员', buyer: '采购商', salesperson: '业务员' }
  const roleColor: Record<string, string> = {
    admin: 'bg-purple-100 text-purple-700',
    buyer: 'bg-blue-100 text-blue-700',
    salesperson: 'bg-green-100 text-green-700',
  }
  const roleIcon: Record<string, string> = { admin: '👑', buyer: '🏪', salesperson: '💼' }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl font-bold text-orange-500 mb-1">友购</div>
          <div className="text-gray-400 text-sm">最简单的叫货平台</div>
        </div>
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">选择账号登录</label>
          <div className="space-y-2">
            {users.map(u => (
              <button key={u.id} onClick={() => setSelected(u.id)}
                className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${selected === u.id ? 'border-orange-400 bg-orange-50' : 'border-gray-100 hover:border-gray-300'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-lg">{roleIcon[u.role]}</div>
                  <div className="text-left">
                    <div className="font-medium text-gray-800">{u.name}</div>
                    <div className="text-xs text-gray-400">{u.phone}</div>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${roleColor[u.role]}`}>{roleLabel[u.role]}</span>
              </button>
            ))}
          </div>
        </div>
        <button onClick={login} disabled={!selected}
          className="w-full py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          进入系统
        </button>
      </div>
    </div>
  )
}
