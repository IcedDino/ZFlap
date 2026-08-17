import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.warn('Supabase env vars missing — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in web/.env.local')
}

export const supabase = createClient(url ?? '', anonKey ?? '')
