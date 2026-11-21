import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

/** null when env vars are missing: the game still works, it just doesn't save anything. */
export const supabase = url && key ? createClient(url, key) : null
export const cloudEnabled = !!supabase
