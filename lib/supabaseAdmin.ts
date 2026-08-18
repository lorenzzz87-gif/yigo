import { createClient, SupabaseClient } from '@supabase/supabase-js'

// SERVER-ONLY client. Uses the service_role key (never exposed to the browser).
// Bypasses RLS, so sensitive tables (users, buyer_profiles) can stay locked to
// anonymous access while the app reaches them through /api route handlers.
// Created lazily so a missing key at build time doesn't crash page-data collection.
let client: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (client) return client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY 未配置（请在 Vercel/.env.local 设置）')
  client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  return client
}
