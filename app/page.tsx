'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { store } from '@/lib/store'

export default function Home() {
  const router = useRouter()
  useEffect(() => {
    const user = store.getCurrentUser()
    if (!user) { router.replace('/login'); return }
    if (user.role === 'buyer') {
      const isB2BHost = window.location.hostname.startsWith('b2b.')
      const isDesktop = window.innerWidth >= 1024
      router.replace(isB2BHost || isDesktop ? '/b2b' : '/buyer')
    } else {
      router.replace(`/${user.role}`)
    }
  }, [router])
  return null
}
