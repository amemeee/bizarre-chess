import { ref, readonly } from 'vue'
import { supabase, cloudEnabled } from '../lib/supabase'

const user = ref(null)
const ready = ref(!cloudEnabled)
let started = false

export function useAuth() {
  if (cloudEnabled && !started) {
    started = true
    supabase.auth.getSession().then(({ data }) => { user.value = data.session?.user ?? null; ready.value = true })
    supabase.auth.onAuthStateChange((_e, session) => { user.value = session?.user ?? null })
  }

  const signInGuest = async () => (await supabase.auth.signInAnonymously()).error
  const signInEmail = async email =>
    (await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })).error
  const signOut = () => supabase.auth.signOut()

  return { user: readonly(user), ready, cloudEnabled, signInGuest, signInEmail, signOut }
}
