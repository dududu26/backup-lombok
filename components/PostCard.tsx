'use client'

import { useState, useRef } from 'react'
import type { Post } from '@/lib/types'

interface PostCardProps {
  post: Post
  currentUserId: string
  onLike: (postId: string, liked: boolean) => void
  onComment: (post: Post) => void
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

export default function PostCard({ post, currentUserId, onLike, onComment }: PostCardProps) {
  const [liked, setLiked] = useState(post.liked ?? false)
  const [likeCount, setLikeCount] = useState(post.like_count)
  const [muted, setMuted] = useState(true)
  const videoRef = useRef<HTMLVideoElement>(null)

  function handleLike() {
    const newLiked = !liked
    setLiked(newLiked)
    setLikeCount(prev => newLiked ? prev + 1 : Math.max(0, prev - 1))
    onLike(post.id, newLiked)
  }

  return (
    <article className="bg-card border border-border/50 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
          style={{ backgroundColor: post.avatar_color }}
        >
          {post.username[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground text-sm leading-tight truncate">{post.username}</p>
          <p className="text-muted-foreground text-xs">{timeAgo(post.created_at)}</p>
        </div>
      </div>

      {/* Caption */}
      {post.caption && (
        <p className="px-4 pb-3 text-foreground text-sm leading-relaxed">{post.caption}</p>
      )}

      {/* Media */}
      {post.media_url && (
        <div className="relative bg-black w-full" style={{ maxHeight: '480px' }}>
          {post.media_type === 'video' ? (
            <div className="relative">
              <video
                ref={videoRef}
                src={post.media_url}
                className="w-full object-contain"
                style={{ maxHeight: '480px' }}
                loop
                playsInline
                muted={muted}
                autoPlay
              />
              <button
                onClick={() => setMuted(m => !m)}
                className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center"
              >
                {muted ? (
                  <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3.63 3.63a.996.996 0 000 1.41L7.29 8.7 7 9H4c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1h3l3.29 3.29c.63.63 1.71.18 1.71-.71v-4.17l4.18 4.18c-.49.37-1.02.68-1.6.91-.36.15-.58.53-.58.92 0 .72.73 1.18 1.39.91.8-.33 1.55-.77 2.22-1.31l1.34 1.34a.996.996 0 101.41-1.41L5.05 3.63c-.39-.39-1.02-.39-1.42 0zM19 12c0 .82-.15 1.61-.41 2.34l1.53 1.53c.56-1.17.88-2.48.88-3.87 0-3.83-2.4-7.11-5.78-8.4-.59-.23-1.22.23-1.22.86v.19c0 .38.25.71.61.85C17.18 6.54 19 9.06 19 12zm-8.71-6.29l-.17.17L12 7.76V6.41c0-.89-1.08-1.33-1.71-.7zM16.5 12A4.5 4.5 0 0014 7.97v1.79l2.48 2.48c.01-.08.02-.16.02-.24z"/>
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 10v4c0 .55.45 1 1 1h3l3.29 3.29c.63.63 1.71.18 1.71-.71V6.41c0-.89-1.08-1.33-1.71-.7L7 9H4c-.55 0-1 .45-1 1zm13.5 2A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                  </svg>
                )}
              </button>
            </div>
          ) : (
            <img
              src={post.media_url}
              alt={post.caption || 'Post media'}
              className="w-full object-contain"
              style={{ maxHeight: '480px' }}
            />
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-5 px-4 py-3">
        <button
          onClick={handleLike}
          className="flex items-center gap-1.5 group"
          aria-label={liked ? 'Unlike post' : 'Like post'}
        >
          <svg
            className={`w-6 h-6 transition-all ${liked ? 'text-primary scale-110' : 'text-muted-foreground group-hover:text-foreground'}`}
            viewBox="0 0 24 24"
            fill={liked ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className={`text-sm font-medium ${liked ? 'text-primary' : 'text-muted-foreground'}`}>{likeCount}</span>
        </button>

        <button
          onClick={() => onComment(post)}
          className="flex items-center gap-1.5 group"
          aria-label="Comment on post"
        >
          <svg className="w-6 h-6 text-muted-foreground group-hover:text-foreground transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-sm font-medium text-muted-foreground">{post.comment_count}</span>
        </button>

        <button className="flex items-center gap-1.5 group ml-auto" aria-label="Share post">
          <svg className="w-6 h-6 text-muted-foreground group-hover:text-foreground transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </article>
  )
}
