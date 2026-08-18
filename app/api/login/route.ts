import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'
import { mapUser } from '@/lib/serverMappers'

export async function POST(request: Request) {
  const { loginValue, password } = await request.json()
  const val = String(loginValue || '').trim()
  if (!val || !password) return Response.json({ user: null })
  const field = val.includes('@') ? 'email' : 'phone'
  const { data } = await getSupabaseAdmin().from('users').select('*').eq(field, val).eq('password', password).maybeSingle()
  return Response.json({ user: data ? mapUser(data) : null })
}
