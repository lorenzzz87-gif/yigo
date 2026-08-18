import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { name, phone, password, code, tempPassword, email } = await request.json()
  const { data: inv } = await getSupabaseAdmin().from('invites').select('*').eq('code', String(code || '').trim()).maybeSingle()
  if (!inv) return Response.json({ ok: false, msg: '商家号不存在，请向批发商索取' })
  if (inv.temp_password !== String(tempPassword || '').trim()) return Response.json({ ok: false, msg: '临时密码错误' })
  if (inv.used) return Response.json({ ok: false, msg: '该商家号已被使用，请向批发商索取新的' })
  if (new Date(inv.expires_at).getTime() < Date.now()) return Response.json({ ok: false, msg: '商家号已过期（超过2天），请向批发商索取新的' })

  const ph = String(phone || '').trim()
  const em = String(email || '').trim().toLowerCase()
  if (ph) {
    const { data: ex } = await getSupabaseAdmin().from('users').select('id').eq('phone', ph).maybeSingle()
    if (ex) return Response.json({ ok: false, msg: '该手机号已注册' })
  }
  if (em) {
    const { data: ex } = await getSupabaseAdmin().from('users').select('id').eq('email', em).maybeSingle()
    if (ex) return Response.json({ ok: false, msg: '该邮箱已注册' })
  }
  const id = `u${Date.now()}`
  const row: Record<string, any> = { id, name, password, role: 'buyer', wholesaler_id: inv.wholesaler_id }
  if (ph) row.phone = ph
  if (em) row.email = em
  const { error } = await getSupabaseAdmin().from('users').insert(row)
  if (error) return Response.json({ ok: false, msg: '注册失败，请重试' })
  await getSupabaseAdmin().from('invites').update({ used: true, used_by: id }).eq('code', inv.code)
  return Response.json({ ok: true, msg: '' })
}
