'use client'
import { useRouter } from 'next/navigation'
import { store, User } from '@/lib/store'

interface NavbarProps {
  user: User
  title: string
  backHref?: string
}

export default function Navbar({ user, title, backHref }: NavbarProps) {
  const router = useRouter()

  function logout() {
    store.setCurrentUser(null)
    router.push('/login')
  }

  const roleLabel: Record<string, string> = { admin: '管理员', buyer: '采购商', salesperson: '业务员' }

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {backHref && (
            <button onClick={() => router.push(backHref)} className="text-gray-500 hover:text-gray-800 mr-1">
              ←
            </button>
          )}
          <span className="font-bold text-orange-500 text-lg">Yigo</span>
          <span className="text-gray-300">|</span>
          <span className="text-gray-700 font-medium">{title}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{user.name}</span>
          <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">{roleLabel[user.role]}</span>
          <button onClick={logout} className="text-xs text-gray-400 hover:text-red-500 transition-colors">退出</button>
        </div>
      </div>
    </nav>
  )
}
