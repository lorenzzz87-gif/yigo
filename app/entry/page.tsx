'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { store } from '@/lib/store'

export default function EntryPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // If already logged in, redirect directly
    const user = store.getCurrentUser()
    if (user) {
      if (user.role === 'buyer') router.replace('/b2b')
      else if (user.role === 'wholesaler') router.replace('/wholesaler')
      else router.replace('/login')
      return
    }
    setReady(true)
  }, [router])

  if (!ready) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="mb-12 text-center">
        <img src="/logo.svg" alt="Yigo" className="h-20 w-auto mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Piattaforma B2B per commercianti</p>
      </div>

      {/* Two entry cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">

        {/* Buyer */}
        <button
          onClick={() => router.push('/b2b-login?role=buyer')}
          className="group bg-white rounded-2xl p-8 shadow-md hover:shadow-xl border-2 border-transparent hover:border-orange-400 transition-all text-left"
        >
          <div className="text-5xl mb-5">🏪</div>
          <div className="text-xl font-bold text-gray-800 mb-2">Sono un acquirente</div>
          <div className="text-sm text-gray-500 mb-1">我是商家</div>
          <div className="text-sm text-gray-400 mt-3">
            Sfoglia il catalogo e ordina prodotti dai tuoi fornitori.
          </div>
          <div className="mt-5 inline-flex items-center gap-2 text-orange-500 font-medium text-sm group-hover:gap-3 transition-all">
            Accedi al portale acquisti →
          </div>
        </button>

        {/* Wholesaler */}
        <button
          onClick={() => router.push('/b2b-login?role=wholesaler')}
          className="group bg-white rounded-2xl p-8 shadow-md hover:shadow-xl border-2 border-transparent hover:border-amber-400 transition-all text-left"
        >
          <div className="text-5xl mb-5">🏬</div>
          <div className="text-xl font-bold text-gray-800 mb-2">Sono un fornitore</div>
          <div className="text-sm text-gray-500 mb-1">我是批发商</div>
          <div className="text-sm text-gray-400 mt-3">
            Gestisci il tuo catalogo, gli ordini e i clienti.
          </div>
          <div className="mt-5 inline-flex items-center gap-2 text-amber-500 font-medium text-sm group-hover:gap-3 transition-all">
            Accedi alla gestione →
          </div>
        </button>
      </div>

      <p className="mt-10 text-xs text-gray-300">
        yigo.eu · B2B Italia
      </p>
    </div>
  )
}
