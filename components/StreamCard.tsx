'use client'

import type { Stream } from '@/lib/types'

interface StreamCardProps {
  stream: Stream
  currentUserId: string
  onWatch: () => void
}

export default function StreamCard({ stream, currentUserId, onWatch }: StreamCardProps) {
  const host = stream.users
  const isOwn = stream.user_id === currentUserId

  return (
    <button
      onClick={onWatch}
      className="w-full text-left rounded-2xl overflow-hidden bg-card border border-border active:scale-98 transition-all group"
    >
      {/* Thumbnail area */}
      <div className="relative h-48 bg-gradient-to-br from-muted to-card flex items-center justify-center">
        {/* Animated bg */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            background: `radial-gradient(ellipse at 50% 50%, ${host?.avatar_color ?? '#FE2C55'} 0%, transparent 70%)`,
          }}
        />

        {/* Camera icon */}
        <div className="relative z-10 flex flex-col items-center gap-2">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white shadow-xl"
            style={{ backgroundColor: host?.avatar_color ?? '#FE2C55' }}
          >
            {host?.username?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex items-center gap-1.5 text-white/80 text-sm">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span>Sedang Live</span>
          </div>
        </div>

        {/* LIVE badge */}
        <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-bold tracking-wide flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          LIVE
        </div>

        {/* Viewer count */}
        <div className="absolute top-3 right-3 px-2 py-1 rounded-lg bg-black/60 text-white text-xs flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
          </svg>
          {stream.viewer_count}
        </div>

        {/* Own stream badge */}
        {isOwn && (
          <div className="absolute bottom-3 left-3 px-2 py-1 rounded-lg bg-black/60 text-white text-xs font-medium">
            Siaran kamu
          </div>
        )}
      </div>

      {/* Info row */}
      <div className="px-4 py-3 flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
          style={{ backgroundColor: host?.avatar_color ?? '#FE2C55' }}
        >
          {host?.username?.[0]?.toUpperCase() ?? '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-foreground font-semibold text-sm truncate">{stream.title}</p>
          <p className="text-muted-foreground text-xs truncate">@{host?.username ?? 'unknown'}</p>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground text-xs">
          <svg className="w-3.5 h-3.5 fill-primary" viewBox="0 0 24 24">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
          {stream.like_count}
        </div>
      </div>
    </button>
  )
}
