'use client'
import { useRef } from 'react'
import { useRouter } from 'next/navigation'
import { store, User } from '@/lib/store'

interface NavbarProps {
  user: User
  title: string
  backHref?: string
  logoUrl?: string
  onLogoUpload?: (file: File) => void
}

export default function Navbar({ user, title, backHref, logoUrl, onLogoUpload }: NavbarProps) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  function logout() {
    store.setCurrentUser(null)
    // b2b.yigo.eu is a fully independent entry — keep logout within it, never bounce to the yigo.eu test page
    const isB2B = typeof window !== 'undefined' && window.location.hostname.startsWith('b2b.')
    router.push(isB2B ? '/entry' : '/login')
  }

  const roleLabel: Record<string, string> = { admin: '平台管理员', wholesaler: '批发商', buyer: '商家', salesperson: '业务员' }

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {backHref && (
            <button onClick={() => router.push(backHref)} className="text-gray-500 hover:text-gray-800 mr-1">←</button>
          )}
          <img src="/logo.svg" alt="Yigo" className="h-8 w-auto" />
          <span className="text-gray-300">|</span>
          <span className="text-gray-700 font-medium">{title}</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Wholesaler logo — upload (wholesaler) or display-only (buyer) */}
          {logoUrl && !onLogoUpload && (
            <img src={logoUrl} alt="logo" className="h-8 w-auto max-w-[80px] object-contain" />
          )}
          {onLogoUpload && (
            <>
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="logo"
                  className="h-8 w-auto max-w-[80px] object-contain cursor-pointer"
                  title="点击更换 Logo"
                  onClick={() => fileRef.current?.click()}
                />
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="text-xs border border-dashed border-gray-300 text-gray-400 px-3 py-1 rounded-lg hover:border-orange-400 hover:text-orange-400 transition-colors"
                >
                  + 上传 Logo
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) onLogoUpload(f); e.target.value = '' }}
              />
            </>
          )}
          <span className="text-sm text-gray-500">{user.name}</span>
          <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">{roleLabel[user.role]}</span>
          <button onClick={logout} className="text-xs text-gray-400 hover:text-red-500 transition-colors">退出</button>
        </div>
      </div>
    </nav>
  )
}
