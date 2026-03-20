import { createClient as _createClient } from '@supabase/supabase-js'

// No-op storage: completely prevents GoTrue from touching localStorage at all,
// eliminating the "orphaned lock" warnings in React Strict Mode.
const noOpStorage = {
  getItem: (_key: string) => null,
  setItem: (_key: string, _value: string) => {},
  removeItem: (_key: string) => {},
}

const supabase = _createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storage: noOpStorage,
    },
  }
)

export function createClient() {
  return supabase
}
