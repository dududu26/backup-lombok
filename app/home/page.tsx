'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Post, Stream, User } from '@/lib/types'
import PostCard from '@/components/PostCard'
import StreamCard from '@/components/StreamCard'
import CreatePostModal from '@/components/CreatePostModal'
import CommentsDrawer from '@/components/CommentsDrawer'

type Tab = 'feed' | 'live'

export default function HomePage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [tab, setTab] = useState<Tab>('feed')

  // Feed state
  const [posts, setPosts] = useState<Post[]>([])
  const [postsLoading, setPostsLoading] = useState(true)
  const [showCreatePost, setShowCreatePost] = useState(false)
  const [commentPost, setCommentPost] = useState<Post | null>(null)

  // Live state
  const [streams, setStreams] = useState<Stream[]>([])
  const [streamsLoading, setStreamsLoading] = useState(true)

  // Track liked post ids
  const likedPostIds = useRef<Set<string>>(new Set())

  const fetchPosts = useCallback(async (userId: string) => {
    const supabase = createClient()
    const { data } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (!data) { setPostsLoading(false); return }

    // Fetch which posts current user has liked
    const { data: likesData } = await supabase
      .from('post_likes')
      .select('post_id')
      .eq('user_id', userId)

    const likedIds = new Set((likesData || []).map((l: { post_id: string }) => l.post_id))
    likedPostIds.current = likedIds

    const withLiked = (data as Post[]).map(p => ({ ...p, liked: likedIds.has(p.id) }))
    setPosts(withLiked)
    setPostsLoading(false)
  }, [])

  const fetchStreams = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('streams')
      .select('*, users(id, username, avatar_color)')
      .eq('is_live', true)
      .order('created_at', { ascending: false })
    setStreams((data as Stream[]) || [])
    setStreamsLoading(false)
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem('tiktok_user')
    if (!stored) { router.replace('/'); return }
    let parsedUser: User
    try {
      parsedUser = JSON.parse(stored)
      if (!parsedUser?.id) throw new Error()
    } catch {
      localStorage.removeItem('tiktok_user')
      router.replace('/')
      return
    }
    setUser(parsedUser)
    fetchPosts(parsedUser.id)
    fetchStreams()

    const supabase = createClient()

    // Realtime: new posts
    const postsChannel = supabase
      .channel('posts-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, (payload) => {
        const newPost = { ...(payload.new as Post), liked: false }
        setPosts(prev => [newPost, ...prev])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts' }, (payload) => {
        setPosts(prev => prev.map(p =>
          p.id === payload.new.id
            ? { ...p, like_count: payload.new.like_count, comment_count: payload.new.comment_count }
            : p
        ))
      })
      .subscribe()

    // Realtime: streams
    const streamsChannel = supabase
      .channel('streams-home')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'streams' }, () => {
        fetchStreams()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(postsChannel)
      supabase.removeChannel(streamsChannel)
    }
  }, [router, fetchPosts, fetchStreams])

  async function handleLike(postId: string, liked: boolean) {
    if (!user) return
    const supabase = createClient()
    const post = posts.find(p => p.id === postId)
    if (!post) return

    if (liked) {
      await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id })
      await supabase.from('posts').update({ like_count: post.like_count + 1 }).eq('id', postId)
    } else {
      await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id)
      await supabase.from('posts').update({ like_count: Math.max(0, post.like_count - 1) }).eq('id', postId)
    }
  }

  function handleCommentAdded(postId: string) {
    setPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, comment_count: p.comment_count + 1 } : p
    ))
  }

  async function handleGoLive() {
    if (!user) return
    const supabase = createClient()
    const { data: stream, error } = await supabase
      .from('streams')
      .insert({ user_id: user.id, title: `${user.username}'s Live`, is_live: true })
      .select()
      .single()
    if (!error && stream) router.push(`/live/${stream.id}`)
  }

  if (!user) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  )

  return (
    <main className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-md border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <svg viewBox="0 0 40 40" className="w-5 h-5 fill-white">
                <path d="M28.5 8h-4.2v16.4c0 2-.8 3.5-2.8 3.5-2 0-3.2-1.5-3.2-3.5 0-1.9 1.1-3.4 3-3.5v-4.3c-4.1.1-7.2 3.2-7.2 7.8 0 4.7 3.3 7.8 7.4 7.8 4.2 0 7.2-3.1 7.2-7.9V16c1.5 1 3.3 1.6 5.3 1.7v-4.2c-2.7-.1-5.5-2.3-5.5-5.5z"/>
              </svg>
            </div>
            <span className="font-bold text-foreground text-lg">TikTok Live</span>
          </div>
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white cursor-pointer"
            style={{ backgroundColor: user.avatar_color }}
          >
            {user.username[0].toUpperCase()}
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-lg mx-auto px-4 flex gap-1 pb-0">
          {(['feed', 'live'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                tab === t
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground'
              }`}
            >
              {t === 'feed' ? 'For You' : (
                <span className="flex items-center justify-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  Live
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      <div className="max-w-lg mx-auto">
        {/* Feed Tab */}
        {tab === 'feed' && (
          <div className="flex flex-col gap-3 px-4 pt-4">
            {postsLoading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="bg-card rounded-2xl overflow-hidden border border-border/50 animate-pulse">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="w-9 h-9 rounded-full bg-muted" />
                    <div className="flex-1">
                      <div className="h-3 bg-muted rounded w-24 mb-2" />
                      <div className="h-2 bg-muted rounded w-16" />
                    </div>
                  </div>
                  <div className="h-48 bg-muted mx-4 mb-3 rounded-xl" />
                  <div className="h-8 bg-muted mx-4 mb-4 rounded" />
                </div>
              ))
            ) : posts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                <div className="w-16 h-16 rounded-full bg-card flex items-center justify-center">
                  <svg className="w-8 h-8 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 16M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <p className="text-foreground font-semibold">Belum ada postingan</p>
                  <p className="text-muted-foreground text-sm mt-1">Jadilah yang pertama posting sesuatu!</p>
                </div>
                <button
                  onClick={() => setShowCreatePost(true)}
                  className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm"
                >
                  Buat Postingan
                </button>
              </div>
            ) : (
              posts.map(post => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUserId={user.id}
                  onLike={handleLike}
                  onComment={setCommentPost}
                />
              ))
            )}
          </div>
        )}

        {/* Live Tab */}
        {tab === 'live' && (
          <div className="px-4 pt-4 flex flex-col gap-4">
            <button
              onClick={handleGoLive}
              className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-semibold text-base flex items-center justify-center gap-3 shadow-lg shadow-primary/20 active:scale-95 transition-all"
            >
              <span className="w-3 h-3 rounded-full bg-white animate-pulse" />
              Mulai Live Sekarang
            </button>

            <div>
              <h2 className="text-foreground font-semibold text-xs uppercase tracking-widest mb-3 flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-primary text-primary-foreground text-xs font-bold">LIVE</span>
                Siaran Aktif
              </h2>

              {streamsLoading ? (
                [...Array(2)].map((_, i) => (
                  <div key={i} className="h-48 rounded-2xl bg-card animate-pulse mb-4" />
                ))
              ) : streams.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                  <div className="w-14 h-14 rounded-full bg-card flex items-center justify-center">
                    <svg className="w-7 h-7 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-foreground font-medium">Belum ada siaran aktif</p>
                    <p className="text-muted-foreground text-sm mt-1">Jadilah yang pertama siaran!</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {streams.map(stream => (
                    <StreamCard
                      key={stream.id}
                      stream={stream}
                      currentUserId={user.id}
                      onWatch={() => router.push(`/watch/${stream.id}`)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Floating create post button (feed tab only) */}
      {tab === 'feed' && (
        <button
          onClick={() => setShowCreatePost(true)}
          className="fixed bottom-6 right-4 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30 flex items-center justify-center z-40 active:scale-95 transition-transform"
          aria-label="Buat postingan baru"
        >
          <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
          </svg>
        </button>
      )}

      {/* Modals */}
      {showCreatePost && (
        <CreatePostModal
          user={user}
          onClose={() => setShowCreatePost(false)}
          onPosted={() => fetchPosts(user.id)}
        />
      )}

      {commentPost && (
        <CommentsDrawer
          post={commentPost}
          user={user}
          onClose={() => setCommentPost(null)}
          onCommentAdded={handleCommentAdded}
        />
      )}
    </main>
  )
}
