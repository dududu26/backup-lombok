'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@/lib/types'

interface CreatePostModalProps {
  user: User
  onClose: () => void
  onPosted: () => void
}

export default function CreatePostModal({ user, onClose, onPosted }: CreatePostModalProps) {
  const [caption, setCaption] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 50 * 1024 * 1024) {
      setError('File maksimal 50MB')
      return
    }
    const isVideo = f.type.startsWith('video/')
    setMediaType(isVideo ? 'video' : 'image')
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setError('')
  }

  function removeMedia() {
    setFile(null)
    setPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!caption.trim() && !file) {
      setError('Tulis caption atau pilih media')
      return
    }
    setUploading(true)
    setError('')
    const supabase = createClient()

    let mediaUrl: string | null = null

    if (file) {
      const ext = file.name.split('.').pop()
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(path, file, { cacheControl: '3600', upsert: false })

      if (uploadError) {
        setError('Gagal upload media, coba lagi')
        setUploading(false)
        return
      }

      const { data: urlData } = supabase.storage.from('media').getPublicUrl(path)
      mediaUrl = urlData.publicUrl
    }

    const { error: insertError } = await supabase.from('posts').insert({
      user_id: user.id,
      username: user.username,
      avatar_color: user.avatar_color,
      caption: caption.trim(),
      media_url: mediaUrl,
      media_type: mediaType,
    })

    if (insertError) {
      setError('Gagal memposting, coba lagi')
      setUploading(false)
      return
    }

    onPosted()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-card rounded-t-3xl border border-border/50 p-5 pb-8"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5" />

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-foreground font-bold text-lg">Buat Postingan</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* User info */}
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
              style={{ backgroundColor: user.avatar_color }}
            >
              {user.username[0].toUpperCase()}
            </div>
            <span className="font-semibold text-foreground">{user.username}</span>
          </div>

          {/* Caption */}
          <textarea
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder="Apa yang ingin kamu bagikan?"
            rows={3}
            maxLength={500}
            className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary text-sm leading-relaxed"
          />

          {/* Media preview */}
          {preview ? (
            <div className="relative rounded-xl overflow-hidden bg-black">
              {mediaType === 'video' ? (
                <video src={preview} className="w-full max-h-64 object-contain" muted controls />
              ) : (
                <img src={preview} alt="Preview" className="w-full max-h-64 object-contain" />
              )}
              <button
                type="button"
                onClick={removeMedia}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 flex items-center justify-center"
              >
                <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-5 rounded-xl border-2 border-dashed border-border flex flex-col items-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 16M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="text-sm font-medium">Tambah Foto / Video</span>
              <span className="text-xs">Maks 50MB</span>
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {error && <p className="text-primary text-sm font-medium">{error}</p>}

          <button
            type="submit"
            disabled={uploading || (!caption.trim() && !file)}
            className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                Memposting...
              </>
            ) : (
              'Posting Sekarang'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
