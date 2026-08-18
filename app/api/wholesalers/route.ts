import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// POST /api/wholesalers → create a wholesaler tenant + its login user (admin op)
export async function POST(request: Request) {
  const { name, contact, phone, password } = await request.json()
  const ph = String(phone || '').trim()
  const { data: existing } = await getSupabaseAdmin().from('users').select('id').eq('phone', ph).maybeSingle()
  if (existing) return Response.json({ ok: false, msg: '该登录手机号已被占用' })
  const wid = `w${Date.now()}`
  const { error: e1 } = await getSupabaseAdmin().from('wholesalers').insert({ id: wid, name, contact: contact || ph, status: 'active' })
  if (e1) return Response.json({ ok: false, msg: '创建批发商失败' })
  const uid = `u${Date.now()}`
  const { error: e2 } = await getSupabaseAdmin().from('users').insert({ id: uid, name, role: 'wholesaler', phone: ph, password, wholesaler_id: wid })
  if (e2) return Response.json({ ok: false, msg: '创建登录账号失败' })
  return Response.json({ ok: true, msg: '' })
}
