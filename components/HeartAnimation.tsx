'use client'

import { useEffect, useRef } from 'react'

interface Heart {
  id: number
  x: number
}

interface HeartAnimationProps {
  hearts: Heart[]
  onExpire: (id: number) => void
}

export default function HeartAnimation({ hearts, onExpire }: HeartAnimationProps) {
  // Keep onExpire in a ref so timer callbacks never become stale
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

  // Track which heart ids already have timers to avoid duplicate timers
  const timerIds = useRef<Set<number>>(new Set())

  useEffect(() => {
    hearts.forEach(heart => {
      if (timerIds.current.has(heart.id)) return
      timerIds.current.add(heart.id)
      const timer = setTimeout(() => {
        onExpireRef.current(heart.id)
        timerIds.current.delete(heart.id)
      }, 1400)
      // Return value of forEach is ignored, so we store cleanup differently
      void timer
    })
  }, [hearts])

  return (
    <div className="absolute bottom-36 right-4 z-20 pointer-events-none w-16 overflow-visible">
      {hearts.slice(-15).map(heart => (
        <div
          key={heart.id}
          className="absolute animate-float-up"
          style={{ bottom: 0, right: `${100 - heart.x}%` }}
        >
          <svg
            className="w-7 h-7 drop-shadow-lg"
            viewBox="0 0 24 24"
            style={{ fill: `hsl(${(heart.id * 37) % 360}, 85%, 65%)` }}
          >
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
        </div>
      ))}
    </div>
  )
}
