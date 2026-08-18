import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'
import { mapProfile } from '@/lib/serverMappers'

// POST /api/buyer-profiles { userIds } → { map: { [userId]: profile } }
export async function POST(request: Request) {
  const { userIds } = await request.json()
  if (!Array.isArray(userIds) || userIds.length === 0) return Response.json({ map: {} })
  const { data } = await getSupabaseAdmin().from('buyer_profiles').select('*').in('user_id', userIds)
  const map: Record<string, any> = {}
  for (const d of data || []) map[d.user_id] = mapProfile(d)
  return Response.json({ map })
}
