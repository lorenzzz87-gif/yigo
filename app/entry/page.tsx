'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShoppingBag, Building2, ArrowRight } from 'lucide-react'
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
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-orange-50 flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="mb-12 text-center">
        <img src="/logo.svg" alt="Yigo" className="h-20 w-auto mx-auto mb-4" />
        <p className="text-gray-600 text-sm">Piattaforma B2B per commercianti · 商家 B2B 订货平台</p>
      </div>

      {/* Two entry cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">

        {/* Buyer */}
        <button
          onClick={() => router.push('/b2b-login?role=buyer')}
          className="group bg-white rounded-2xl p-8 shadow-sm hover:shadow-lg border border-gray-200 hover:border-orange-400 transition-all duration-200 text-left"
        >
          <div className="w-12 h-12 rounded-lg border border-orange-200 bg-orange-50 flex items-center justify-center mb-6">
            <ShoppingBag className="w-6 h-6 text-orange-600" strokeWidth={1.5} />
          </div>
          <div className="text-xl font-bold text-gray-900 mb-1">Sono un acquirente</div>
          <div className="text-sm font-medium text-orange-600 mb-3">我是商家</div>
          <div className="text-sm text-gray-600 leading-relaxed min-h-[2.5rem]">
            Sfoglia il catalogo e ordina prodotti dai tuoi fornitori.
          </div>
          <div className="mt-6 pt-5 border-t border-gray-100 inline-flex items-center gap-1.5 text-orange-600 font-semibold text-sm group-hover:gap-2.5 transition-all">
            Accedi al portale acquisti
            <ArrowRight className="w-4 h-4" strokeWidth={2} />
          </div>
        </button>

        {/* Wholesaler */}
        <button
          onClick={() => router.push('/b2b-login?role=wholesaler')}
          className="group bg-white rounded-2xl p-8 shadow-sm hover:shadow-lg border border-gray-200 hover:border-amber-400 transition-all duration-200 text-left"
        >
          <div className="w-12 h-12 rounded-lg border border-amber-200 bg-amber-50 flex items-center justify-center mb-6">
            <Building2 className="w-6 h-6 text-amber-600" strokeWidth={1.5} />
          </div>
          <div className="text-xl font-bold text-gray-900 mb-1">Sono un fornitore</div>
          <div className="text-sm font-medium text-amber-600 mb-3">我是批发商</div>
          <div className="text-sm text-gray-600 leading-relaxed min-h-[2.5rem]">
            Gestisci il tuo catalogo, gli ordini e i clienti.
          </div>
          <div className="mt-6 pt-5 border-t border-gray-100 inline-flex items-center gap-1.5 text-amber-600 font-semibold text-sm group-hover:gap-2.5 transition-all">
            Accedi alla gestione
            <ArrowRight className="w-4 h-4" strokeWidth={2} />
          </div>
        </button>
      </div>

      <p className="mt-10 text-xs text-gray-500">
        yigo.eu · B2B Italia
      </p>
    </div>
  )
}
