import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'
import { mapUser } from '@/lib/serverMappers'

// GET /api/users                     → all users (admin)
// GET /api/users?wholesalerId=&role= → filtered (e.g. a wholesaler's buyers)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const wholesalerId = searchParams.get('wholesalerId')
  const role = searchParams.get('role')
  let q = getSupabaseAdmin().from('users').select('*')
  if (wholesalerId) q = q.eq('wholesaler_id', wholesalerId)
  if (role) q = q.eq('role', role)
  const { data } = await q
  return Response.json({ users: (data || []).map(mapUser) })
}
