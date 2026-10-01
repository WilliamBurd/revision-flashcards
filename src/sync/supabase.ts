import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Set in .env.local for local development and in Vercel's Environment
// Variables for the live site (see README). Without them the app runs on this
// device only, as in Phase 1.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } }) : null
