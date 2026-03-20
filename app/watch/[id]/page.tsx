'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User, ChatMessage, Stream, WebRTCSignal } from '@/lib/types'
import ChatOverlay from '@/components/ChatOverlay'
import HeartAnimation from '@/components/HeartAnimation'

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

export default function WatchPage() {
  const router = useRouter()
  const params = useParams()
  const streamId = Array.isArray(params.id) ? params.id[0] : (params.id as string)

  const videoRef = useRef<HTMLVideoElement>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const prevLikeRef = useRef(0)

  const [user, setUser] = useState<User | null>(null)
  const [stream, setStream] = useState<Stream | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [hearts, setHearts] = useState<{ id: number; x: number }[]>([])
  const [connecting, setConnecting] = useState(true)
  const [streamEnded, setStreamEnded] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('tiktok_user')
    if (!stored) { router.replace('/'); return }
    const currentUser: User = JSON.parse(stored)
    setUser(currentUser)

    const supabase = createClient()

    async function handleSignal(signal: WebRTCSignal) {
      if (signal.signal_type === 'offer' && signal.to_user_id === currentUser.id) {
        if (pcRef.current) {
          pcRef.current.close()
        }
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
        pcRef.current = pc

        pc.ontrack = (event) => {
          if (videoRef.current && event.streams[0]) {
            videoRef.current.srcObject = event.streams[0]
            setConnecting(false)
          }
        }

        pc.onicecandidate = async (event) => {
          if (event.candidate) {
            await supabase.from('webrtc_signals').insert({
              stream_id: streamId,
              from_user_id: currentUser.id,
              to_user_id: signal.from_user_id,
              signal_type: 'ice-candidate',
              payload: { candidate: event.candidate },
            })
          }
        }

        await pc.setRemoteDescription(new RTCSessionDescription(signal.payload.sdp as RTCSessionDescriptionInit))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        await supabase.from('webrtc_signals').insert({
          stream_id: streamId,
          from_user_id: currentUser.id,
          to_user_id: signal.from_user_id,
          signal_type: 'answer',
          payload: { sdp: answer },
        })
      }

      if (signal.signal_type === 'ice-candidate' && signal.to_user_id === currentUser.id) {
        if (pcRef.current && signal.payload.candidate) {
          try {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(signal.payload.candidate as RTCIceCandidateInit))
          } catch { /* ignore */ }
        }
      }
    }

    async function init() {
      const { data: streamData } = await supabase
        .from('streams')
        .select('*, users(id, username, avatar_color)')
        .eq('id', streamId)
        .single()

      if (!streamData || !streamData.is_live) {
        setStreamEnded(true)
        setConnecting(false)
        return
      }
      setStream(streamData as Stream)
      prevLikeRef.current = streamData.like_count

      const { data: msgData } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('stream_id', streamId)
        .order('created_at', { ascending: true })
        .limit(50)
      setMessages((msgData as ChatMessage[]) || [])

      // Signal broadcaster that viewer joined
      await supabase.from('webrtc_signals').insert({
        stream_id: streamId,
        from_user_id: currentUser.id,
        to_user_id: streamData.user_id,
        signal_type: 'viewer-join',
        payload: { username: currentUser.username },
      })
    }

    init()

    const channel = supabase
      .channel(`watch-${streamId}-${currentUser.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `stream_id=eq.${streamId}` },
        (payload) => {
          setMessages(prev => [...prev.slice(-49), payload.new as ChatMessage])
        }
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'webrtc_signals', filter: `stream_id=eq.${streamId}` },
        (payload) => { handleSignal(payload.new as WebRTCSignal) }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'streams', filter: `id=eq.${streamId}` },
        (payload) => {
          if (!payload.new.is_live) {
            setStreamEnded(true)
          }
          setStream(prev => prev ? { ...prev, ...(payload.new as Partial<Stream>) } : null)
          const newLikeCount = payload.new.like_count as number
          const prev = prevLikeRef.current
          if (newLikeCount > prev) {
            const diff = Math.min(newLikeCount - prev, 5)
            const newHearts = Array.from({ length: diff }, (_, i) => ({
              id: Date.now() + i,
              x: 60 + Math.random() * 40,
            }))
            setHearts(h => [...h, ...newHearts])
          }
          prevLikeRef.current = newLikeCount
        }
      )
      .subscribe()

    return () => {
      pcRef.current?.close()
      pcRef.current = null
      supabase.removeChannel(channel)
      // Decrement viewer count on leave
      supabase
        .from('streams')
        .select('viewer_count')
        .eq('id', streamId)
        .single()
        .then(({ data }) => {
          if (data) {
            supabase.from('streams').update({ viewer_count: Math.max(0, data.viewer_count - 1) }).eq('id', streamId)
          }
        })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamId])

  async function sendLike() {
    if (!stream) return
    const supabase = createClient()
    const newCount = stream.like_count + 1
    setStream(prev => prev ? { ...prev, like_count: newCount } : null)
    setHearts(prev => [...prev, { id: Date.now(), x: 60 + Math.random() * 40 }])
    await supabase.from('streams').update({ like_count: newCount }).eq('id', streamId)
  }

  async function sendMessage(text: string) {
    if (!user) return
    const supabase = createClient()
    await supabase.from('chat_messages').insert({
      stream_id: streamId,
      user_id: user.id,
      username: user.username,
      message: text,
    })
  }

  const host = stream?.users

  return (
    <main className="fixed inset-0 bg-black overflow-hidden">
      {/* Video stream */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Connecting overlay */}
      {connecting && !streamEnded && (
        <div className="absolute inset-0 bg-black/80 z-20 flex flex-col items-center justify-center gap-4">
          {host && (
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white border-2 border-white shadow-2xl"
              style={{ backgroundColor: host.avatar_color }}
            >
              {host.username[0].toUpperCase()}
            </div>
          )}
          <div className="flex items-center gap-2 text-white">
            <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
            <span className="text-sm font-medium">Menghubungkan ke siaran...</span>
          </div>
        </div>
      )}

      {/* Stream ended overlay */}
      {streamEnded && (
        <div className="absolute inset-0 bg-black/90 z-20 flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 rounded-full bg-card flex items-center justify-center">
            <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
          </div>
          <p className="text-white text-lg font-semibold">Siaran telah berakhir</p>
          <button
            onClick={() => router.replace('/home')}
            className="mt-2 px-8 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm active:scale-95 transition-all"
          >
            Kembali ke Beranda
          </button>
        </div>
      )}

      {/* Dark gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-start justify-between px-4 pt-12 pb-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-black/50 rounded-full px-3 py-1.5">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-white text-xs font-bold tracking-wider">LIVE</span>
          </div>
          {stream && (
            <div className="flex items-center gap-1.5 bg-black/50 rounded-full px-3 py-1.5">
              <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
              </svg>
              <span className="text-white text-xs font-medium">{stream.viewer_count}</span>
            </div>
          )}
        </div>

        <button
          onClick={() => router.replace('/home')}
          className="bg-black/50 text-white text-xl w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-all"
          aria-label="Tutup"
        >
          &times;
        </button>
      </div>

      {/* Right Side Actions */}
      <div className="absolute right-4 bottom-36 z-10 flex flex-col items-center gap-5">
        {host && (
          <div className="flex flex-col items-center gap-1">
            <div
              className="w-12 h-12 rounded-full border-2 border-white flex items-center justify-center text-base font-bold text-white shadow-lg"
              style={{ backgroundColor: host.avatar_color }}
            >
              {host.username[0].toUpperCase()}
            </div>
            <span className="text-white text-xs font-medium drop-shadow max-w-14 truncate text-center">
              {host.username}
            </span>
          </div>
        )}

        <button
          onClick={sendLike}
          className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
          aria-label="Like"
        >
          <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
            <svg className="w-6 h-6 fill-primary" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
          </div>
          <span className="text-white text-xs font-medium">{stream?.like_count ?? 0}</span>
        </button>
      </div>

      {/* Heart Animations */}
      <HeartAnimation hearts={hearts} onExpire={(id) => setHearts(prev => prev.filter(h => h.id !== id))} />

      {/* Chat Overlay */}
      <div className="absolute bottom-0 left-0 right-0 z-10">
        <ChatOverlay
          messages={messages}
          currentUser={user}
          onSend={sendMessage}
          isReady={!connecting && !streamEnded}
        />
      </div>
    </main>
  )
}
