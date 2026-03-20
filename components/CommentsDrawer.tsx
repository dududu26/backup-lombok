'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Post, PostComment, User } from '@/lib/types'

interface CommentsDrawerProps {
  post: Post
  user: User
  onClose: () => void
  onCommentAdded: (postId: string) => void
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'baru saja'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}j`
  return `${Math.floor(hrs / 24)}h`
}

export default function CommentsDrawer({ post, user, onClose, onCommentAdded }: CommentsDrawerProps) {
  const [comments, setComments] = useState<PostComment[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()

    async function fetchComments() {
      const { data } = await supabase
        .from('post_comments')
        .select('*')
        .eq('post_id', post.id)
        .order('created_at', { ascending: true })
      setComments((data as PostComment[]) || [])
      setLoading(false)
    }

    fetchComments()

    const channel = supabase
      .channel(`comments-${post.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'post_comments',
        filter: `post_id=eq.${post.id}`,
      }, (payload) => {
        setComments(prev => [...prev, payload.new as PostComment])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [post.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || sending) return
    setSending(true)
    const supabase = createClient()

    await supabase.from('post_comments').insert({
      post_id: post.id,
      user_id: user.id,
      username: user.username,
      avatar_color: user.avatar_color,
      text: text.trim(),
    })

    await supabase.from('posts').update({ comment_count: post.comment_count + 1 }).eq('id', post.id)

    onCommentAdded(post.id)
    setText('')
    setSending(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-card rounded-t-3xl border border-border/50 flex flex-col"
        style={{ maxHeight: '75vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-border absolute left-1/2 -translate-x-1/2 top-3" />
          <h2 className="text-foreground font-bold text-base">Komentar</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Comments list */}
        <div className="flex-1 overflow-y-auto px-5 py-3 flex flex-col gap-4 scrollbar-hide">
          {loading ? (
            <div className="flex justify-center py-8">
              <span className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
              <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p className="text-sm">Belum ada komentar. Jadilah yang pertama!</p>
            </div>
          ) : (
            comments.map(c => (
              <div key={c.id} className="flex items-start gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: c.avatar_color }}
                >
                  {c.username[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground text-sm">{c.username}</span>
                    <span className="text-muted-foreground text-xs">{timeAgo(c.created_at)}</span>
                  </div>
                  <p className="text-foreground text-sm leading-relaxed mt-0.5">{c.text}</p>
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form
          onSubmit={handleSend}
          className="flex items-center gap-3 px-4 py-3 border-t border-border/50 flex-shrink-0"
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{ backgroundColor: user.avatar_color }}
          >
            {user.username[0].toUpperCase()}
          </div>
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Tambahkan komentar..."
            maxLength={300}
            className="flex-1 bg-background rounded-full px-4 py-2 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary border border-border"
          />
          <button
            type="submit"
            disabled={!text.trim() || sending}
            className="w-9 h-9 rounded-full bg-primary flex items-center justify-center disabled:opacity-40 flex-shrink-0 transition-opacity"
          >
            {sending ? (
              <span className="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
            ) : (
              <svg className="w-4 h-4 text-primary-foreground" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
