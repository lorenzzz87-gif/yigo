import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'
import { mapProfile, profileToRow } from '@/lib/serverMappers'

// GET /api/profile?userId=  → single buyer profile
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  if (!userId) return Response.json({ profile: null })
  const { data } = await getSupabaseAdmin().from('buyer_profiles').select('*').eq('user_id', userId).maybeSingle()
  return Response.json({ profile: data ? mapProfile(data) : null })
}

// POST /api/profile { profile }  → upsert
export async function POST(request: Request) {
  const { profile } = await request.json()
  if (!profile?.userId) return Response.json({ ok: false, error: 'missing userId' }, { status: 400 })
  const { error } = await getSupabaseAdmin().from('buyer_profiles').upsert(profileToRow(profile), { onConflict: 'user_id' })
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
