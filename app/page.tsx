'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const AVATAR_COLORS = [
  '#FE2C55', '#25F4EE', '#FF6B35', '#A259FF',
  '#00C9A7', '#FF6B9D', '#FFD700', '#00B4D8',
]

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('tiktok_user')
    if (stored) {
      try {
        const user = JSON.parse(stored)
        if (user?.id && user?.username) {
          router.replace('/home')
          return
        }
      } catch {
        localStorage.removeItem('tiktok_user')
      }
    }
    setChecking(false)
  }, [router])

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = username.trim()
    if (!trimmed || trimmed.length < 2) {
      setError('Username minimal 2 karakter')
      return
    }
    if (trimmed.length > 24) {
      setError('Username maksimal 24 karakter')
      return
    }
    setLoading(true)
    setError('')

    const supabase = createClient()
    const randomColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]

    // Try to find existing user first
    const { data: existing } = await supabase
      .from('users')
      .select('*')
      .eq('username', trimmed)
      .maybeSingle()

    if (existing) {
      localStorage.setItem('tiktok_user', JSON.stringify(existing))
      router.push('/home')
      return
    }

    // Create new user
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({ username: trimmed, avatar_color: randomColor })
      .select()
      .single()

    if (insertError) {
      if (insertError.code === '23505') {
        setError('Username sudah digunakan, coba yang lain')
      } else {
        setError('Gagal membuat akun, coba lagi')
      }
      setLoading(false)
      return
    }

    localStorage.setItem('tiktok_user', JSON.stringify(newUser))
    router.push('/home')
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">

        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center shadow-2xl shadow-primary/30">
            <svg viewBox="0 0 40 40" className="w-12 h-12 fill-white" xmlns="http://www.w3.org/2000/svg">
              <path d="M28.5 8h-4.2v16.4c0 2-.8 3.5-2.8 3.5-2 0-3.2-1.5-3.2-3.5 0-1.9 1.1-3.4 3-3.5v-4.3c-4.1.1-7.2 3.2-7.2 7.8 0 4.7 3.3 7.8 7.4 7.8 4.2 0 7.2-3.1 7.2-7.9V16c1.5 1 3.3 1.6 5.3 1.7v-4.2c-2.7-.1-5.5-2.3-5.5-5.5z"/>
            </svg>
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-bold text-foreground tracking-tight">TikTok Live</h1>
            <p className="text-muted-foreground text-sm mt-1">Siaran langsung secara real-time</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleJoin} className="w-full flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="username" className="text-sm font-medium text-foreground">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError('') }}
              placeholder="Masukkan username kamu..."
              maxLength={24}
              autoComplete="off"
              autoCapitalize="none"
              className="w-full px-4 py-3.5 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-base transition-all"
            />
            {error && (
              <p className="text-destructive-foreground text-sm">{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !username.trim()}
            className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-base transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                Masuk...
              </span>
            ) : (
              'Masuk Sekarang'
            )}
          </button>
        </form>

        <p className="text-muted-foreground text-xs text-center">
          Tidak perlu email atau password. Cukup pilih username!
        </p>
      </div>
    </main>
  )
}
