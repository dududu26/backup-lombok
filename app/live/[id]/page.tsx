'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User, ChatMessage, WebRTCSignal } from '@/lib/types'
import ChatOverlay from '@/components/ChatOverlay'
import HeartAnimation from '@/components/HeartAnimation'

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

export default function LivePage() {
  const router = useRouter()
  const params = useParams()
  const streamId = Array.isArray(params.id) ? params.id[0] : (params.id as string)

  const videoRef = useRef<HTMLVideoElement>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const viewerCountRef = useRef(0)
  // Store router in a ref so it never causes the effect to re-run
  const routerRef = useRef(router)
  routerRef.current = router

  const [user, setUser] = useState<User | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [viewerCount, setViewerCount] = useState(0)
  const [likeCount, setLikeCount] = useState(0)
  const [hearts, setHearts] = useState<{ id: number; x: number }[]>([])
  const [cameraError, setCameraError] = useState('')
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    let mounted = true

    const stored = localStorage.getItem('tiktok_user')
    if (!stored) { routerRef.current.replace('/'); return }

    let currentUser: User
    try {
      currentUser = JSON.parse(stored)
      if (!currentUser?.id) throw new Error()
    } catch {
      localStorage.removeItem('tiktok_user')
      routerRef.current.replace('/')
      return
    }

    // Only call setUser once on mount — guard with mounted flag
    if (mounted) setUser(currentUser)

    const supabase = createClient()

    async function createPeerForViewer(viewerId: string) {
      if (peersRef.current.has(viewerId)) return
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

      localStreamRef.current?.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!)
      })

      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          await supabase.from('webrtc_signals').insert({
            stream_id: streamId,
            from_user_id: currentUser.id,
            to_user_id: viewerId,
            signal_type: 'ice-candidate',
            payload: { candidate: event.candidate },
          })
        }
      }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      await supabase.from('webrtc_signals').insert({
        stream_id: streamId,
        from_user_id: currentUser.id,
        to_user_id: viewerId,
        signal_type: 'offer',
        payload: { sdp: offer },
      })

      peersRef.current.set(viewerId, pc)
    }

    async function handleSignal(signal: WebRTCSignal) {
      if (signal.signal_type === 'viewer-join') {
        const viewerId = signal.from_user_id
        await createPeerForViewer(viewerId)
        viewerCountRef.current += 1
        setViewerCount(viewerCountRef.current)
        await supabase.from('streams').update({ viewer_count: viewerCountRef.current }).eq('id', streamId)
      }

      if (signal.signal_type === 'answer' && signal.to_user_id === currentUser.id) {
        const pc = peersRef.current.get(signal.from_user_id)
        if (pc && pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.payload.sdp as RTCSessionDescriptionInit))
        }
      }

      if (signal.signal_type === 'ice-candidate' && signal.to_user_id === currentUser.id) {
        const pc = peersRef.current.get(signal.from_user_id)
        if (pc && signal.payload.candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(signal.payload.candidate as RTCIceCandidateInit))
          } catch { /* ignore stale candidates */ }
        }
      }
    }

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 1280 } },
          audio: true,
        })
        localStreamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
        setIsReady(true)
      } catch (err) {
        console.error('[v0] Camera error:', err)
        setCameraError('Tidak dapat mengakses kamera. Pastikan izin kamera diaktifkan.')
      }
    }

    async function loadExistingData() {
      const { data: msgData } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('stream_id', streamId)
        .order('created_at', { ascending: true })
        .limit(50)
      setMessages((msgData as ChatMessage[]) || [])

      const { data: streamData } = await supabase
        .from('streams')
        .select('viewer_count, like_count')
        .eq('id', streamId)
        .single()
      if (streamData) {
        viewerCountRef.current = streamData.viewer_count
        setViewerCount(streamData.viewer_count)
        setLikeCount(streamData.like_count)
      }
    }

    startCamera()
    loadExistingData()

    const channel = supabase
      .channel(`live-${streamId}-${currentUser.id}`)
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
          const newLikes = payload.new.like_count as number
          setLikeCount(prev => {
            if (newLikes > prev) {
              const diff = Math.min(newLikes - prev, 5)
              const newHearts = Array.from({ length: diff }, (_, i) => ({
                id: Date.now() + i,
                x: 60 + Math.random() * 40,
              }))
              setHearts(h => [...h, ...newHearts])
            }
            return newLikes
          })
          setViewerCount(payload.new.viewer_count)
          viewerCountRef.current = payload.new.viewer_count
        }
      )
      .subscribe()

    return () => {
      localStreamRef.current?.getTracks().forEach(t => t.stop())
      peersRef.current.forEach(pc => pc.close())
      peersRef.current.clear()
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamId])

  async function endStream() {
    const supabase = createClient()
    await supabase.from('streams').update({ is_live: false, ended_at: new Date().toISOString() }).eq('id', streamId)
    localStreamRef.current?.getTracks().forEach(t => t.stop())
    router.replace('/home')
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

  return (
    <main className="fixed inset-0 bg-black overflow-hidden">
      {/* Camera Feed */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: 'scaleX(-1)' }}
      />

      {/* Dark gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />

      {cameraError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
          <div className="text-center px-6">
            <div className="w-16 h-16 rounded-full bg-red-900/40 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
              </svg>
            </div>
            <p className="text-white text-sm font-medium">{cameraError}</p>
            <button onClick={() => router.replace('/home')} className="mt-4 px-6 py-2 rounded-xl bg-white/20 text-white text-sm">
              Kembali
            </button>
          </div>
        </div>
      )}

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-start justify-between px-4 pt-12 pb-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-black/50 rounded-full px-3 py-1.5">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-white text-xs font-bold tracking-wider">LIVE</span>
          </div>
          <div className="flex items-center gap-1.5 bg-black/50 rounded-full px-3 py-1.5">
            <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
            </svg>
            <span className="text-white text-xs font-medium">{viewerCount}</span>
          </div>
        </div>

        <button
          onClick={endStream}
          className="bg-black/50 text-white text-xs font-semibold px-4 py-2 rounded-full active:scale-95 transition-all"
        >
          Akhiri
        </button>
      </div>

      {/* Right Side Actions */}
      <div className="absolute right-4 bottom-36 z-10 flex flex-col items-center gap-5">
        {user && (
          <div className="flex flex-col items-center gap-1">
            <div
              className="w-12 h-12 rounded-full border-2 border-white flex items-center justify-center text-base font-bold text-white shadow-lg"
              style={{ backgroundColor: user.avatar_color }}
            >
              {user.username[0].toUpperCase()}
            </div>
          </div>
        )}
        <div className="flex flex-col items-center gap-1">
          <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
            <svg className="w-6 h-6 fill-white" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
          </div>
          <span className="text-white text-xs font-medium">{likeCount}</span>
        </div>
      </div>

      {/* Heart Animations */}
      <HeartAnimation hearts={hearts} onExpire={(id) => setHearts(prev => prev.filter(h => h.id !== id))} />

      {/* Chat Overlay */}
      <div className="absolute bottom-0 left-0 right-0 z-10">
        <ChatOverlay
          messages={messages}
          currentUser={user}
          onSend={sendMessage}
          isReady={isReady}
        />
      </div>
    </main>
  )
}
