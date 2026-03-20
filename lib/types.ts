export interface User {
  id: string
  username: string
  avatar_color: string
  created_at: string
}

export interface Stream {
  id: string
  user_id: string
  title: string
  is_live: boolean
  viewer_count: number
  like_count: number
  created_at: string
  ended_at: string | null
  users?: User
}

export interface ChatMessage {
  id: string
  stream_id: string
  user_id: string
  username: string
  message: string
  created_at: string
}

export interface WebRTCSignal {
  id: string
  stream_id: string
  from_user_id: string
  to_user_id: string | null
  signal_type: 'offer' | 'answer' | 'ice-candidate' | 'viewer-join' | 'broadcaster-ready'
  payload: Record<string, unknown>
  created_at: string
}

export interface Post {
  id: string
  user_id: string
  username: string
  avatar_color: string
  caption: string
  media_url: string | null
  media_type: 'image' | 'video'
  like_count: number
  comment_count: number
  created_at: string
  liked?: boolean
}

export interface PostComment {
  id: string
  post_id: string
  user_id: string
  username: string
  avatar_color: string
  text: string
  created_at: string
}
