'use client'

import { useState, useRef, useEffect } from 'react'
import type { ChatMessage, User } from '@/lib/types'

interface ChatOverlayProps {
  messages: ChatMessage[]
  currentUser: User | null
  onSend: (text: string) => Promise<void>
  isReady: boolean
}

const USERNAME_COLORS = [
  '#25F4EE', '#FE2C55', '#A259FF', '#FF6B35',
  '#00C9A7', '#FF6B9D', '#FFD700', '#00B4D8',
]

function getUserColor(username: string): string {
  let hash = 0
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash)
  }
  return USERNAME_COLORS[Math.abs(hash) % USERNAME_COLORS.length]
}

export default function ChatOverlay({ messages, currentUser, onSend, isReady }: ChatOverlayProps) {
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || !isReady || sending) return
    setSending(true)
    setInput('')
    await onSend(trimmed)
    setSending(false)
  }

  return (
    <div className="flex flex-col px-3 pb-4 gap-2">
      {/* Messages list */}
      <div className="flex flex-col gap-1 max-h-52 overflow-y-auto scrollbar-hide justify-end">
        {messages.slice(-20).map((msg) => (
          <div key={msg.id} className="flex items-start gap-1.5 max-w-[85%]">
            <span
              className="text-xs font-bold shrink-0 mt-0.5"
              style={{ color: getUserColor(msg.username) }}
            >
              {msg.username}
            </span>
            <span className="text-white text-xs leading-relaxed break-words">{msg.message}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isReady ? `Kirim pesan...` : 'Menghubungkan...'}
          disabled={!isReady}
          maxLength={200}
          className="flex-1 px-4 py-2.5 rounded-full bg-white/10 backdrop-blur-sm text-white placeholder:text-white/40 text-sm border border-white/20 focus:outline-none focus:border-white/40 disabled:opacity-50 transition-all"
        />
        <button
          type="submit"
          disabled={!input.trim() || !isReady || sending}
          className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0 disabled:opacity-40 active:scale-90 transition-all"
          aria-label="Kirim"
        >
          <svg className="w-4 h-4 fill-white rotate-90" viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </form>
    </div>
  )
}
