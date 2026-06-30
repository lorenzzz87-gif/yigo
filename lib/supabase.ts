import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// persistSession: false — we do our own auth via localStorage (yg_current_user).
// Without this, a stale Supabase Auth JWT in browser storage overrides the anon key
// and RLS silently blocks inserts.
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})
